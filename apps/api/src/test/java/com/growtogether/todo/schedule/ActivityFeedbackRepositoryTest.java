package com.growtogether.todo.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import com.growtogether.todo.*;
import jakarta.persistence.EntityManager;
import java.time.*;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
class ActivityFeedbackRepositoryTest {
    @Autowired TodoRepository todos;
    @Autowired EntityManager em;
    final LocalDate today = LocalDate.of(2026,11,13);

    Todo save(Long owner, String title, LocalDate day, LocalTime time, boolean completed, ChildReaction reaction) {
        var todo = new Todo(owner,title,null,day,time);
        todo.setCompleted(completed);
        todo.setChildReaction(reaction);
        return todos.save(todo);
    }

    @Test void boundsByOwnerCompletionReactionDateTimeAndDatabaseLimit() {
        var older=save(1L,"older",today.minusDays(30),LocalTime.NOON,true,ChildReaction.NEUTRAL);
        var first=save(1L,"same-time",today.minusDays(1),LocalTime.NOON,true,ChildReaction.DIFFICULT);
        var second=save(1L,"same-time",today.minusDays(1),LocalTime.NOON,true,ChildReaction.ENJOYED);
        var current=save(1L,"today",today,LocalTime.NOON,true,ChildReaction.ENJOYED);
        save(2L,"private",today,LocalTime.NOON,true,ChildReaction.ENJOYED);
        save(1L,"unrecorded",today,LocalTime.NOON,true,null);
        save(1L,"incomplete",today,LocalTime.NOON,false,null);
        save(1L,"future-time",today,LocalTime.of(12,1),true,ChildReaction.ENJOYED);
        save(1L,"future-day",today.plusDays(1),LocalTime.NOON,true,ChildReaction.ENJOYED);
        save(1L,"outside",today.minusDays(31),LocalTime.NOON,true,ChildReaction.ENJOYED);
        em.flush();em.clear();
        var rows=todos.findActivityFeedback(1L,today.minusDays(30),today.plusDays(1),today,LocalTime.NOON,PageRequest.of(0,51));
        assertThat(rows).extracting(Todo::getId).containsExactly(current.getId(),second.getId(),first.getId(),older.getId());
        assertThat(todos.findActivityFeedback(1L,today.minusDays(30),today,today,LocalTime.NOON,PageRequest.of(0,2)))
                .extracting(Todo::getId).containsExactly(second.getId(),first.getId());
        // Past feedback does not need the duration required by occupied time slots.
        assertThat(rows).allMatch(todo -> todo.getDurationMinutes()==null);
    }
}
