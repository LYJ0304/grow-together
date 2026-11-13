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

    /*
     * TODO(refactor): 리뷰 합의에 따라 구조 분리는 후속 작업으로 미룬다.
     * https://github.com/LYJ0304/grow-together/pull/190#discussion_r4546614913
     *
     * 문제: read()에 기간/월령 정책, JPA 조회, 집계, API/Worker 투영, hash 생성이 섞여 있다.
     * 단순히 메서드 길이를 줄이는 대신, 서로 다른 변경 이유(SRP)를 격리하는 방향으로 진행한다.
     * 1. 먼저 의미 있는 private 함수부터 추출해 read()를 단계 조율자로 만든다. 기간 결정 ->
     *    owner 범위 원본 수집 -> 순수 집계 -> API/Worker 투영 순서와 입력/출력을 드러낸다.
     *    재사용/응집도상 필요가 확인될 때만 별도 컴포넌트로 옮기며 단계마다 클래스를 만들지 않는다.
     * 2. Clock의 now는 한 번만 읽어 모든 단계에 전달한다. owner 조회와 lazy 관계 복사는 기존
     *    read-only 트랜잭션 안에서 끝내고, 계산 단계에는 변경하지 않는 값 스냅샷을 전달한다.
     *    계산 함수가 Repository/Clock을 다시 호출하거나 JPA 관계를 변경하지 않도록 한다.
     * 3. 통계/순위/기억 생성과 Worker 입력 선별은 별도 이름으로 표현한다. 전체 planned와 경과
     *    eligible 분모, 0분모 null, 일기 날짜 distinct, 실제 owner+주간 연결만 사용하는 규칙,
     *    날짜 없는 legacy 제외, 결정적 정렬/동률 및 Unicode 발췌/개수 제한을 그대로 보존한다.
     * 4. sourceHash는 출력/Worker 샘플로 줄이기 전의 전체 원본, eligible IDs, 프로필, 기준일을
     *    계속 반영해야 한다. DTO 조립 편의를 위해 hash 근거를 발췌 목록으로 대체하지 않는다.
     *    내부 hash 재료와 외부 전송 재료를 구분해 Worker로 이름/생일/사진 URL이 새지 않게 한다.
     * 완료 검증: Reader 단위 테스트로 시간 경계/미래 일정/0분모/순위/샘플 밖 변경을 고정한 뒤
     * 작은 추출마다 실행한다. Repository/Integration/Postgres 테스트로 소유권·실제 관계를,
     * Contract 테스트로 JSON fixture와 동일한 응답/Worker 입력을 확인하고 이 TODO를 제거한다.
     * 아래 자료의 원칙을 현재 코드에 적용한 제안이며, 특정 클래스 분할을 강제하는 규칙은 아니다.
     * SRP: https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html
     * Extract Function: https://refactoring.com/catalog/extractFunction.html
     */
    @Transactional(readOnly = true)
    public Snapshot read(Long owner, LocalDate requested) {
        var now = OffsetDateTime.ofInstant(clock.instant(), SEOUL);
        var today = now.toLocalDate();
        var thisMonday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        var start = requested == null ? thisMonday : requested;
        if (start.getYear() < 1 || start.getYear() > 9998 || start.getDayOfWeek() != DayOfWeek.MONDAY
                || start.isAfter(thisMonday))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "지난 주 또는 이번 주 월요일을 선택해 주세요.");
        if (!users.existsById(owner)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "계정을 찾을 수 없어요.");
        var end = start.plusWeeks(1);
        boolean current = start.equals(thisMonday);
        var reference = current ? today : end.minusDays(1);
        var period = new ReportPeriod(start, end.minusDays(1), end, now, current);
        var all = todos.findByUserIdAndScheduledDateGreaterThanEqualAndScheduledDateLessThanOrderByScheduledDateAscScheduledTimeAscIdAsc(owner, start, end);
        var eligible = all.stream().filter(t -> !current || !t.getScheduledDate().atTime(t.getScheduledTime())
                .isAfter(now.toLocalDateTime())).toList();
        var completed = eligible.stream().filter(Todo::isCompleted).toList();
        var visible = eligible.stream().collect(Collectors.toMap(Todo::getId, t -> t));
        var dated = diaries.findByUserIdAndDiaryDateGreaterThanEqualAndDiaryDateLessThanOrderByDiaryDateAsc(
                owner, start, current ? today.plusDays(1) : end);
        var diarySources = dated.stream().sorted(Comparator.comparing(com.growtogether.diary.domain.Diary::getDiaryDate)
                        .thenComparing(com.growtogether.diary.domain.Diary::getId))
                .map(d -> new DiarySource(d.getId(), d.getDiaryDate(), d.getContent(), d.getTodos().stream()
                        .filter(t -> owner.equals(t.getUserId()) && visible.containsKey(t.getId()))
                        .sorted(Comparator.comparing(Todo::getScheduledDate).thenComparing(Todo::getScheduledTime)
                                .thenComparing(Todo::getId)).map(Todo::getId).toList())).toList();
        var daily = start.datesUntil(end).map(day -> new ReportDaily(day,
                completed.stream().filter(t -> t.getScheduledDate().equals(day)).count())).toList();
        var metrics = new ReportMetrics(all.size(), eligible.size(), completed.size(),
                diarySources.stream().map(DiarySource::date).distinct().count(),
                eligible.isEmpty() ? null : (double) completed.size() / eligible.size(), daily);
        var ranked = completed.stream().collect(Collectors.groupingBy(t -> t.getPlanName().trim(), Collectors.counting()))
                .entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed()
                        .thenComparing(Map.Entry.comparingByKey())).map(e -> new ReportActivity(e.getKey(), e.getValue())).toList();
        var memories = diarySources.stream().limit(7).map(d -> new ReportMemory(d.id(), d.date(), excerpt(d.content()),
                d.links().stream().limit(20).map(id -> new ReportLinkedTodo(id, visible.get(id).getPlanName())).toList(),
                d.links().size() > 20)).toList();
        ChildProfile profile = children.findById(owner).orElse(null);
        var profileSource = profile == null ? null : new ProfileSource(profile.getName(), profile.getBirthday(),
                profile.getPrematurityStatus(), profile.getExpectedDueDate(),
                profile.getConcerns().stream().sorted().toList(), profile.getAvailableActivityTime());
        long months = profile == null ? -1 : ChronoUnit.MONTHS.between(profile.getBirthday(), reference);
        boolean validProfile = profile != null && !profile.getBirthday().isAfter(reference) && months >= 0 && months <= 72;
        var child = validProfile ? new ReportChildContext((int) months, reference, profileSource.concerns(), profileSource.availableTime()) : null;
        var hash = hash(new HashSource(owner, start, current, reference,
                all.stream().map(t -> new TodoSource(t.getId(), t.getPlanName(), t.getContent(),
                        t.getScheduledDate(), t.getScheduledTime(), t.isCompleted(), t.getChildReaction())).toList(), eligible.stream().map(Todo::getId).toList(), diarySources, profileSource));
        var sources = new ReportWorkerSources(completed.stream().limit(50).map(t -> new ReportWorkerTodo(t.getId(),
                        t.getPlanName(), t.getScheduledDate(), t.getScheduledTime(), t.getChildReaction())).toList(),
                diarySources.stream().filter(d -> d.content() != null && !d.content().isBlank()).limit(7)
                        .map(d -> new ReportWorkerDiary(d.id(), d.date(), excerpt(d.content()))).toList(), completed.size() > 50);
        String restriction = !validProfile ? "PROFILE_UNAVAILABLE"
                : sources.todos().isEmpty() && sources.diaries().isEmpty() ? "NO_EVIDENCE" : null;
        var report = new WeeklyReportResponse(period, metrics, ranked.stream().limit(5).toList(), ranked.size() > 5,
                memories, hash, PROMPT_VERSION, ReportInsight.of(restriction == null ? ReportInsightState.NOT_GENERATED
                        : ReportInsightState.INSUFFICIENT_EVIDENCE, restriction));
        return new Snapshot(report, new ReportWorkerRequest(hash, PROMPT_VERSION,
                new ReportWorkerPeriod(start, end.minusDays(1), end, now, current),
                new ReportWorkerMetrics(metrics.planned(), metrics.eligible(), metrics.completed(), metrics.diaryDays(),
                        metrics.completionRate(), metrics.daily()), child, sources), restriction);
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
