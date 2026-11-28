package com.growtogether.report;

import com.growtogether.report.dto.ReportActivity;
import com.growtogether.report.dto.ReportChildContext;
import com.growtogether.report.dto.ReportDaily;
import com.growtogether.report.dto.ReportInsight;
import com.growtogether.report.dto.ReportInsightState;
import com.growtogether.report.dto.ReportLinkedTodo;
import com.growtogether.report.dto.ReportMemory;
import com.growtogether.report.dto.ReportMetrics;
import com.growtogether.report.dto.ReportPeriod;
import com.growtogether.report.dto.ReportWorkerDiary;
import com.growtogether.report.dto.ReportWorkerMetrics;
import com.growtogether.report.dto.ReportWorkerPeriod;
import com.growtogether.report.dto.ReportWorkerRequest;
import com.growtogether.report.dto.ReportWorkerSources;
import com.growtogether.report.dto.ReportWorkerTodo;
import com.growtogether.report.dto.WeeklyReportResponse;
import static com.growtogether.report.dto.ReportWorkerRequest.PROMPT_VERSION;

import com.growtogether.auth.AuthRepository;
import com.growtogether.child.ChildProfile;
import com.growtogether.child.ChildProfileRepository;
import com.growtogether.diary.DiaryRepository;
import com.growtogether.todo.Todo;
import com.growtogether.todo.TodoRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class WeeklyReportReader {
    static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private final TodoRepository todos;
    private final DiaryRepository diaries;
    private final ChildProfileRepository children;
    private final AuthRepository users;
    private final Clock clock;
    private final ObjectMapper mapper;

    public record Snapshot(WeeklyReportResponse report, ReportWorkerRequest input, String restriction) {
        WeeklyReportResponse with(ReportInsight insight) {
            return new WeeklyReportResponse(report.period(), report.metrics(), report.majorActivities(),
                    report.activitiesTruncated(), report.memories(), report.sourceHash(), PROMPT_VERSION, insight);
        }
    }
    private record TodoSource(Long id, String title, String content, LocalDate date, LocalTime time, boolean completed, com.growtogether.todo.ChildReaction childReaction) {}
    private record DiarySource(Long id, LocalDate date, String content, List<Long> links) {}
    private record ProfileSource(String name, LocalDate birthday, String prematurity, LocalDate dueDate,
                                 List<String> concerns, String availableTime) {}
    private record HashSource(Long owner, LocalDate start, boolean current, LocalDate referenceDay,
                              List<TodoSource> todos, List<Long> eligibleIds, List<DiarySource> diaries, ProfileSource profile) {}

    private record ReadPeriod(ReportPeriod report, LocalDate referenceDay) {}
    private record OwnedSources(List<TodoSource> all, List<TodoSource> eligible,
                                List<DiarySource> diaries, ProfileSource profile) {}

    @Transactional(readOnly = true)
    public Snapshot read(Long owner, LocalDate requested) {
        var period = selectPeriod(requested, OffsetDateTime.ofInstant(clock.instant(), SEOUL));
        requireOwner(owner);
        var sources = loadSources(owner, period);
        var completed = sources.eligible().stream().filter(TodoSource::completed).toList();
        var metrics = calculateMetrics(period, sources, completed);
        var ranked = rankActivities(completed);
        var memories = selectMemories(sources);
        var child = childContext(sources.profile(), period.referenceDay());
        var sourceHash = hashSource(owner, period, sources);
        var evidence = selectWorkerEvidence(completed, sources.diaries());
        return assembleSnapshot(period, metrics, ranked, memories, child, sourceHash, evidence);
    }

    private ReadPeriod selectPeriod(LocalDate requested, OffsetDateTime now) {
        var today = now.toLocalDate();
        var thisMonday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        var start = requested == null ? thisMonday : requested;
        if (start.getYear() < 1 || start.getYear() > 9998 || start.getDayOfWeek() != DayOfWeek.MONDAY
                || start.isAfter(thisMonday))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "지난 주 또는 이번 주 월요일을 선택해 주세요.");
        var end = start.plusWeeks(1);
        boolean current = start.equals(thisMonday);
        return new ReadPeriod(new ReportPeriod(start, end.minusDays(1), end, now, current),
                current ? today : end.minusDays(1));
    }

    private void requireOwner(Long owner) {
        if (!users.existsById(owner))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "계정을 찾을 수 없어요.");
    }

    // Copy lazy relations before leaving read()'s transaction. Calculations below use values only.
    private OwnedSources loadSources(Long owner, ReadPeriod period) {
        var range = period.report();
        var all = todos.findByUserIdAndScheduledDateGreaterThanEqualAndScheduledDateLessThanOrderByScheduledDateAscScheduledTimeAscIdAsc(
                        owner, range.start(), range.endExclusive()).stream()
                .map(t -> new TodoSource(t.getId(), t.getPlanName(), t.getContent(), t.getScheduledDate(),
                        t.getScheduledTime(), t.isCompleted(), t.getChildReaction())).toList();
        var eligible = all.stream().filter(t -> !range.current()
                || !t.date().atTime(t.time()).isAfter(range.asOf().toLocalDateTime())).toList();
        var visibleIds = eligible.stream().map(TodoSource::id).collect(Collectors.toSet());
        var diaryEnd = range.current() ? range.asOf().toLocalDate().plusDays(1) : range.endExclusive();
        var diarySources = diaries.findByUserIdAndDiaryDateGreaterThanEqualAndDiaryDateLessThanOrderByDiaryDateAsc(
                        owner, range.start(), diaryEnd).stream()
                .sorted(Comparator.comparing(com.growtogether.diary.domain.Diary::getDiaryDate)
                        .thenComparing(com.growtogether.diary.domain.Diary::getId))
                .map(d -> new DiarySource(d.getId(), d.getDiaryDate(), d.getContent(), d.getTodos().stream()
                        .filter(t -> owner.equals(t.getUserId()) && visibleIds.contains(t.getId()))
                        .sorted(Comparator.comparing(Todo::getScheduledDate).thenComparing(Todo::getScheduledTime)
                                .thenComparing(Todo::getId)).map(Todo::getId).toList())).toList();
        ChildProfile profile = children.findById(owner).orElse(null);
        var profileSource = profile == null ? null : new ProfileSource(profile.getName(), profile.getBirthday(),
                profile.getPrematurityStatus(), profile.getExpectedDueDate(),
                profile.getConcerns().stream().sorted().toList(), profile.getAvailableActivityTime());
        return new OwnedSources(all, eligible, diarySources, profileSource);
    }

    private ReportMetrics calculateMetrics(ReadPeriod period, OwnedSources sources, List<TodoSource> completed) {
        var daily = period.report().start().datesUntil(period.report().endExclusive())
                .map(day -> new ReportDaily(day, completed.stream().filter(t -> t.date().equals(day)).count())).toList();
        return new ReportMetrics(sources.all().size(), sources.eligible().size(), completed.size(),
                sources.diaries().stream().map(DiarySource::date).distinct().count(),
                sources.eligible().isEmpty() ? null : (double) completed.size() / sources.eligible().size(), daily);
    }

    private List<ReportActivity> rankActivities(List<TodoSource> completed) {
        return completed.stream().collect(Collectors.groupingBy(t -> t.title().trim(), Collectors.counting()))
                .entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed()
                        .thenComparing(Map.Entry.comparingByKey()))
                .map(e -> new ReportActivity(e.getKey(), e.getValue())).toList();
    }

    private List<ReportMemory> selectMemories(OwnedSources sources) {
        var visible = sources.eligible().stream().collect(Collectors.toMap(TodoSource::id, t -> t));
        return sources.diaries().stream().limit(7).map(d -> new ReportMemory(d.id(), d.date(), excerpt(d.content()),
                d.links().stream().limit(20).map(id -> new ReportLinkedTodo(id, visible.get(id).title())).toList(),
                d.links().size() > 20)).toList();
    }

    private ReportChildContext childContext(ProfileSource profile, LocalDate reference) {
        if (profile == null) return null;
        long months = ChronoUnit.MONTHS.between(profile.birthday(), reference);
        if (profile.birthday().isAfter(reference) || months < 0 || months > 72) return null;
        return new ReportChildContext((int) months, reference, profile.concerns(), profile.availableTime());
    }

    private String hashSource(Long owner, ReadPeriod period, OwnedSources sources) {
        // Hash the complete ordered sources, never the limited API/Worker projections.
        return hash(new HashSource(owner, period.report().start(), period.report().current(), period.referenceDay(),
                sources.all(), sources.eligible().stream().map(TodoSource::id).toList(), sources.diaries(), sources.profile()));
    }

    private ReportWorkerSources selectWorkerEvidence(List<TodoSource> completed, List<DiarySource> diarySources) {
        return new ReportWorkerSources(completed.stream().limit(50).map(t -> new ReportWorkerTodo(t.id(),
                        t.title(), t.date(), t.time(), t.childReaction())).toList(),
                diarySources.stream().filter(d -> d.content() != null && !d.content().isBlank()).limit(7)
                        .map(d -> new ReportWorkerDiary(d.id(), d.date(), excerpt(d.content()))).toList(), completed.size() > 50);
    }

    private Snapshot assembleSnapshot(ReadPeriod period, ReportMetrics metrics, List<ReportActivity> ranked,
            List<ReportMemory> memories, ReportChildContext child, String sourceHash, ReportWorkerSources evidence) {
        String restriction = child == null ? "PROFILE_UNAVAILABLE"
                : evidence.todos().isEmpty() && evidence.diaries().isEmpty() ? "NO_EVIDENCE" : null;
        var range = period.report();
        var report = new WeeklyReportResponse(range, metrics, ranked.stream().limit(5).toList(), ranked.size() > 5,
                memories, sourceHash, PROMPT_VERSION, ReportInsight.of(restriction == null ? ReportInsightState.NOT_GENERATED
                        : ReportInsightState.INSUFFICIENT_EVIDENCE, restriction));
        var input = new ReportWorkerRequest(sourceHash, PROMPT_VERSION,
                new ReportWorkerPeriod(range.start(), range.end(), range.endExclusive(), range.asOf(), range.current()),
                new ReportWorkerMetrics(metrics.planned(), metrics.eligible(), metrics.completed(), metrics.diaryDays(),
                        metrics.completionRate(), metrics.daily()), child, evidence);
        return new Snapshot(report, input, restriction);
    }

    static String excerpt(String content) {
        if (content == null) return "";
        return content.substring(0, content.offsetByCodePoints(0, Math.min(240, content.codePointCount(0, content.length()))));
    }
    private String hash(HashSource source) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(mapper.writeValueAsString(source).getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }
}
