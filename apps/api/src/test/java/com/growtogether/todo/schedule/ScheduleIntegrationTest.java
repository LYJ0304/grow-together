package com.growtogether.todo.schedule;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.growtogether.todo.schedule.ScheduleDtos.*;
import com.growtogether.auth.AuthRepository;
import com.growtogether.user.User;
import com.growtogether.todo.*;
import com.growtogether.child.*;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@SpringBootTest
@ActiveProfiles("test")
class ScheduleIntegrationTest {
    @Autowired AuthRepository users;
    @Autowired TodoRepository todos;
    @Autowired ChildProfileRepository children;
    @Autowired ScheduleGenerationService generation;
    @Autowired ScheduleBatchService batch;
    @MockitoBean ScheduleWorkerClient worker;
    @Test void personalizesWithoutTransactionAndSavesOnlyConfirmedCandidates() {
        var owner = users.save(new User("Owner","schedule-"+System.nanoTime()+"@example.com","test")).getId();
        var other = users.save(new User("Other","other-"+System.nanoTime()+"@example.com","test")).getId();
        var date = LocalDate.of(2026,11,10);
        todos.save(new Todo(other,"private",null,date,LocalTime.of(9,0)));
        var child = new ChildProfile(owner,"Do not send name",LocalDate.of(2022,11,10));
        child.replacePersonalization("unknown",null,List.of("sleep"),"5min");
        children.save(child);
        when(worker.generate(any())).thenAnswer(call -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            WorkerRequest request = call.getArgument(0);
            assertThat(request.existingSchedules()).isEmpty();
            assertThat(request.childContext().ageMonths()).isEqualTo(48);
            assertThat(request.childContext().personalization().concernCodes()).containsExactly("sleep");
            return new WorkerResponse(date,List.of(new WorkerCandidate("read",null,date,LocalTime.of(9,0),5)),List.of());
        });
        var preview = generation.generate(owner,new GenerateRequest(date,"",List.of(new Window(LocalTime.of(9,0),LocalTime.of(10,0))),null));
        assertThat(todos.findByUserIdAndScheduledDateOrderByScheduledTimeAsc(owner,date)).isEmpty();
        assertThat(batch.save(owner,new BatchRequest(date,preview.candidates()))).hasSize(1);
        assertThatThrownBy(() -> batch.save(owner,new BatchRequest(date,preview.candidates())));
        assertThat(todos.findByUserIdAndScheduledDateOrderByScheduledTimeAsc(owner,date)).hasSize(1);
        assertThat(todos.findByUserIdAndScheduledDateOrderByScheduledTimeAsc(other,date)).hasSize(1);
    }
    @Test void rejectsUnknownExistingDurationBeforeModelAndBatchIsAllOrNothing() {
        var owner = users.save(new User("Owner","legacy-"+System.nanoTime()+"@example.com","test")).getId();
        var date = LocalDate.of(2026,11,11);
        todos.save(new Todo(owner,"unknown",null,date,LocalTime.of(9,0)));
        assertThatThrownBy(() -> generation.generate(owner,new GenerateRequest(date,null,List.of(new Window(LocalTime.of(9,0),LocalTime.of(10,0))),null)));
        verifyNoInteractions(worker);
        assertThatThrownBy(() -> batch.save(owner,new BatchRequest(date.plusDays(1),List.of(
                new Candidate("one",null,LocalTime.of(9,0),10),new Candidate("two",null,LocalTime.of(9,5),10)))));
        assertThat(todos.findByUserIdAndScheduledDateOrderByScheduledTimeAsc(owner,date.plusDays(1))).isEmpty();
    }
}
