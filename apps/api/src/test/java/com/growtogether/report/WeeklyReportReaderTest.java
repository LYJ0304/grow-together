package com.growtogether.report;

import com.growtogether.report.dto.ReportActivity;
import com.growtogether.report.dto.ReportLinkedTodo;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.growtogether.auth.AuthRepository;
import com.growtogether.child.*;
import com.growtogether.diary.DiaryRepository;
import com.growtogether.diary.domain.Diary;
import com.growtogether.todo.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

class WeeklyReportReaderTest {
    final TodoRepository todos = mock(TodoRepository.class);
    final DiaryRepository diaries = mock(DiaryRepository.class);
    final ChildProfileRepository children = mock(ChildProfileRepository.class);
    final AuthRepository users = mock(AuthRepository.class);
    final LocalDate monday = LocalDate.of(2026, 11, 9);
    final Clock clock = Clock.fixed(Instant.parse("2026-11-11T03:00:00Z"), ZoneOffset.UTC);
    final WeeklyReportReader reader = new WeeklyReportReader(todos, diaries, children, users, clock, JsonMapper.builder().build());
    @BeforeEach void account() { when(users.existsById(1L)).thenReturn(true); }
    Todo todo(long id, String title, LocalDate date, LocalTime time, boolean completed) {
        var t = new Todo(1L, title, null, date, time);
        ReflectionTestUtils.setField(t, "id", id); t.setCompleted(completed); return t;
    }
    Diary diary(long id, LocalDate date, String content) {
        var d = new Diary(1L, date, content); ReflectionTestUtils.setField(d,"id",id); return d;
    }
    void sources(List<Todo> list, List<Diary> ds) {
        when(todos.findByUserIdAndScheduledDateGreaterThanEqualAndScheduledDateLessThanOrderByScheduledDateAscScheduledTimeAscIdAsc(eq(1L), any(), any())).thenReturn(list);
        when(diaries.findByUserIdAndDiaryDateGreaterThanEqualAndDiaryDateLessThanOrderByDiaryDateAsc(eq(1L),any(),any())).thenReturn(ds);
    }
    @Test void separatesFuturePlansAndZeroDenominatorAndDistinctDiaryDates() {
        sources(List.of(todo(1,"과거",monday,LocalTime.NOON,true),
                todo(2,"지금",monday.plusDays(2),LocalTime.NOON,false),
                todo(3,"미래",monday.plusDays(2),LocalTime.of(12,1),true)),
                List.of(diary(11,monday,"a"), diary(12,monday,"b")));
        var r=reader.read(1L,null).report();
        assertThat(r.metrics().planned()).isEqualTo(3); assertThat(r.metrics().eligible()).isEqualTo(2);
        assertThat(r.metrics().completed()).isEqualTo(1); assertThat(r.metrics().completionRate()).isEqualTo(.5);
        assertThat(r.metrics().diaryDays()).isEqualTo(1); assertThat(r.metrics().daily()).hasSize(7);
        assertThat(r.period().asOf().getOffset()).isEqualTo(ZoneOffset.ofHours(9));
        sources(List.of(todo(1,"아직",monday.plusDays(3),LocalTime.NOON,true)),List.of());
        assertThat(reader.read(1L,monday).report().metrics().completionRate()).isNull();
    }
    @Test void exactTitlesHaveStableTieOrderAndActualOwnerScopedRelationsOnly() {
        var a=todo(1," B ",monday,LocalTime.NOON,true); var b=todo(2,"A",monday,LocalTime.NOON,true);
        var foreign=new Todo(2L,"비공개",null,monday,LocalTime.NOON);
        ReflectionTestUtils.setField(foreign,"id",3L);
        var d=diary(9,monday,"실제 일기");d.replaceTodos(List.of(a,foreign));
        sources(List.of(a,b),List.of(d));var r=reader.read(1L,monday).report();
        assertThat(r.majorActivities()).extracting(ReportActivity::title).containsExactly("A","B");
        assertThat(r.memories().getFirst().activities()).extracting(ReportLinkedTodo::id).containsExactly(1L);
        assertThat(r.memories().getFirst().excerpt()).isEqualTo("실제 일기");
    }
    @Test void fullSourceHashChangesBeyondSamplesAndForProfileAndTimeEligibility() {
        var list=new ArrayList<Todo>();
        for(long i=1;i<=55;i++)list.add(todo(i,"활동",monday,LocalTime.NOON,true));
        sources(list,List.of(diary(9,monday,"🙂".repeat(300))));
        var first=reader.read(1L,monday);
        assertThat(first.input().sources().todos()).hasSize(50);assertThat(first.input().sources().todosTruncated()).isTrue();
        assertThat(first.report().memories().getFirst().excerpt().codePointCount(0,first.report().memories().getFirst().excerpt().length())).isEqualTo(240);
        list.getLast().update("변경",null,monday,LocalTime.NOON);
        assertThat(reader.read(1L,monday).report().sourceHash()).isNotEqualTo(first.report().sourceHash());
        when(children.findById(1L)).thenReturn(Optional.of(new ChildProfile(1L,"아이",LocalDate.of(2025,1,1))));
        var second=reader.read(1L,monday);
        assertThat(second.restriction()).isNull(); assertThat(second.input().childContext().ageMonths()).isEqualTo(22);
        var later=new WeeklyReportReader(todos,diaries,children,users,
                Clock.fixed(clock.instant().plusSeconds(60),ZoneOffset.UTC),JsonMapper.builder().build());
        assertThat(later.read(1L,monday).report().sourceHash()).isEqualTo(second.report().sourceHash());
        list.add(todo(99,"직후",monday.plusDays(2),LocalTime.of(12,1),false));
        assertThat(later.read(1L,monday).report().sourceHash()).isNotEqualTo(reader.read(1L,monday).report().sourceHash());
    }
    @ParameterizedTest @ValueSource(strings={"2026-11-10","2026-11-16","0000-01-03","9999-01-04"})
    void rejectsInvalidWeek(String input) {
        assertThatThrownBy(()->reader.read(1L,LocalDate.parse(input))).isInstanceOfSatisfying(ResponseStatusException.class,
                e->assertThat(e.getStatusCode().value()).isEqualTo(400));
    }
    @Test void yearLeapAndSeoulMidnightBoundaries() {
        var fixed=new WeeklyReportReader(todos,diaries,children,users,
                Clock.fixed(Instant.parse("2024-02-25T15:00:00Z"),ZoneOffset.UTC),JsonMapper.builder().build());
        assertThat(fixed.read(1L,null).report().period().start()).isEqualTo("2024-02-26");
        assertThat(fixed.read(1L,null).report().period().end()).isEqualTo("2024-03-03");
        assertThat(reader.read(1L,LocalDate.of(2025,12,29)).report().period().end()).isEqualTo("2026-01-04");
        assertThat(reader.read(1L,monday).restriction()).isEqualTo("PROFILE_UNAVAILABLE");
        when(children.findById(1L)).thenReturn(Optional.of(new ChildProfile(1L,"아이",LocalDate.of(2025,1,1))));
        assertThat(reader.read(1L,monday).restriction()).isEqualTo("NO_EVIDENCE");
    }
    @Test void pastWeekUsesFullWeekAndAgeUsesItsSunday() {
        var past=monday.minusWeeks(1);
        sources(List.of(todo(1,"일요일",past.plusDays(6),LocalTime.of(23,59),true)),List.of());
        when(children.findById(1L)).thenReturn(Optional.of(new ChildProfile(1L,"아이",past.plusDays(6))));
        var snapshot=reader.read(1L,past);
        assertThat(snapshot.report().period().current()).isFalse();
        assertThat(snapshot.report().metrics().completionRate()).isEqualTo(1.0);
        assertThat(snapshot.input().childContext().ageMonths()).isZero();
        assertThat(snapshot.input().childContext().ageAsOf()).isEqualTo(past.plusDays(6));
        when(children.findById(1L)).thenReturn(Optional.of(new ChildProfile(1L,"아이",past.plusDays(7))));
        assertThat(reader.read(1L,past).restriction()).isEqualTo("PROFILE_UNAVAILABLE");
    }
    @Test void ageAboveSupportedRangeNeverBlocksBasicMetrics() {
        sources(List.of(todo(1,"활동",monday,LocalTime.NOON,true)),List.of());
        when(children.findById(1L)).thenReturn(Optional.of(new ChildProfile(1L,"아이",LocalDate.of(2010,1,1))));
        var snapshot=reader.read(1L,monday);
        assertThat(snapshot.restriction()).isEqualTo("PROFILE_UNAVAILABLE");
        assertThat(snapshot.report().metrics().completed()).isEqualTo(1);
    }

}
