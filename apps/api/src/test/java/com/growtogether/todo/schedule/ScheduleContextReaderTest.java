package com.growtogether.todo.schedule;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.growtogether.child.ChildProfileRepository;
import com.growtogether.todo.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

class ScheduleContextReaderTest {
    @Test void separatesFeedbackFromOccupiedSlotsAndAppliesClockAndLimit() {
        var todos=mock(TodoRepository.class);
        var children=mock(ChildProfileRepository.class);
        var clock=Clock.fixed(Instant.parse("2026-11-12T15:00:00Z"),ZoneOffset.UTC);
        var reader=new ScheduleContextReader(todos,children,clock);
        var date=LocalDate.of(2026,11,14);
        var history=new ArrayList<Todo>();
        for(long id=1;id<=51;id++) {
            var todo=new Todo(1L,"activity",null,date.minusDays(1),LocalTime.MIDNIGHT);
            todo.setCompleted(true);todo.setChildReaction(ChildReaction.ENJOYED);
            ReflectionTestUtils.setField(todo,"id",id);history.add(todo);
        }
        when(todos.findActivityFeedback(eq(1L),eq(date.minusDays(30)),eq(date),eq(date.minusDays(1)),eq(LocalTime.MIDNIGHT),any(Pageable.class)))
                .thenAnswer(call -> { assertThat(((Pageable)call.getArgument(5)).getPageSize()).isEqualTo(51); return history; });
        var context=reader.read(1L,date);
        assertThat(context.existing()).isEmpty();
        assertThat(context.activityFeedback()).hasSize(50);
        assertThat(context.activityFeedbackTruncated()).isTrue();
        assertThat(context.activityFeedback().getFirst().childReaction()).isEqualTo(ChildReaction.ENJOYED);
        reader.read(1L,date.minusDays(2));
        verify(todos).findActivityFeedback(eq(1L),eq(date.minusDays(32)),eq(date.minusDays(2)),eq(date.minusDays(1)),eq(LocalTime.MIDNIGHT),any(Pageable.class));
        clearInvocations(todos);
        assertThat(reader.read(1L,date.plusDays(60)).activityFeedback()).isEmpty();
        verify(todos,never()).findActivityFeedback(any(),any(),any(),any(),any(),any());
    }
}
