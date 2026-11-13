package com.growtogether.todo;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.growtogether.user.User;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class TodoReactionServiceTest {
    TodoRepository repository = mock(TodoRepository.class);
    TodoService service = new TodoService(repository);
    Todo todo;
    @BeforeEach void setUp() {
        todo = new Todo(7L, "Walk", "Memo", LocalDate.of(2026,11,13), LocalTime.of(9,0));
        when(repository.lockOwner(7L)).thenReturn(Optional.of(new User("Owner","owner@test.com","hash")));
        when(repository.findByIdAndUserId(1L,7L)).thenReturn(Optional.of(todo));
    }
    @Test void savesChangesAndClearsReactionOnlyWhenCompleted() {
        assertThatThrownBy(() -> service.setReaction(7L,1L,ChildReaction.ENJOYED))
            .isInstanceOfSatisfying(ResponseStatusException.class,e -> assertThat(e.getStatusCode().value()).isEqualTo(409));
        assertThat(todo.getChildReaction()).isNull();
        service.setCompletion(7L,1L,true);
        for (ChildReaction reaction : ChildReaction.values()) {
            assertThat(service.setReaction(7L,1L,reaction).childReaction()).isEqualTo(reaction);
        }
        assertThat(service.setReaction(7L,1L,null).childReaction()).isNull();
        service.setReaction(7L,1L,ChildReaction.ENJOYED);
        assertThat(service.setCompletion(7L,1L,false).childReaction()).isNull();
        assertThat(service.setCompletion(7L,1L,true).childReaction()).isNull();
        verify(repository,atLeastOnce()).lockOwner(7L);
    }
    @Test void ownerScopedLookupProtectsOtherUsers() {
        when(repository.findByIdAndUserId(1L,7L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.setReaction(7L,1L,ChildReaction.ENJOYED))
            .isInstanceOfSatisfying(ResponseStatusException.class,e -> assertThat(e.getStatusCode().value()).isEqualTo(404));
        verify(repository,never()).save(any());
    }
}
