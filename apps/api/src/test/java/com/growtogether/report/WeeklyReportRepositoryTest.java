package com.growtogether.report;

import static org.assertj.core.api.Assertions.*;
import com.growtogether.todo.*;
import com.growtogether.diary.*;
import com.growtogether.diary.domain.Diary;
import java.time.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import jakarta.persistence.EntityManager;

@DataJpaTest
@ActiveProfiles("test")
class WeeklyReportRepositoryTest {
    @Autowired TodoRepository todos;
    @Autowired DiaryRepository diaries;
    @Autowired EntityManager em;
    @Test void rangeOrderingOwnershipAndActualLinksSurviveFlushAndClear() {
        var start=LocalDate.of(2026,11,9);
        var late=todos.save(new Todo(1L,"late",null,start.plusDays(6),LocalTime.NOON));
        var first=todos.save(new Todo(1L,"first",null,start,LocalTime.NOON));
        var same=todos.save(new Todo(1L,"same",null,start,LocalTime.NOON));
        todos.save(new Todo(2L,"private",null,start,LocalTime.NOON));
        todos.save(new Todo(1L,"end",null,start.plusDays(7),LocalTime.NOON));
        todos.save(new Todo(1L,"before",null,start.minusDays(1),LocalTime.NOON));
        diaries.save(new Diary(1L,"undated legacy"));
        var diary=diaries.save(new Diary(1L,start,"실제 연결"));diary.replaceTodos(java.util.List.of(first));
        em.flush();em.clear();
        assertThat(todos.findByUserIdAndScheduledDateGreaterThanEqualAndScheduledDateLessThanOrderByScheduledDateAscScheduledTimeAscIdAsc(1L,start,start.plusDays(7)))
                .extracting(Todo::getId).containsExactly(first.getId(),same.getId(),late.getId());
        var dated=diaries.findByUserIdAndDiaryDateGreaterThanEqualAndDiaryDateLessThanOrderByDiaryDateAsc(1L,start,start.plusDays(7));
        assertThat(dated).hasSize(1);assertThat(dated.getFirst().getTodos()).extracting(Todo::getId).containsExactly(first.getId());
    }
}
