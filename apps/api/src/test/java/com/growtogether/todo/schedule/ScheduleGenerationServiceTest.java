package com.growtogether.todo.schedule;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.growtogether.todo.schedule.ScheduleDtos.*;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import jakarta.validation.Validation;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
class ScheduleGenerationServiceTest {
    @ParameterizedTest @ValueSource(strings={"null","empty","date","candidateDate","outside","duplicate","budget","invalid"})
    void rejectsInvalidUpstreamResults(String kind) {
        var date=LocalDate.of(2026,11,10);
        var reader=mock(ScheduleContextReader.class);var worker=mock(ScheduleWorkerClient.class);
        when(reader.read(1L,date)).thenReturn(new Context(List.of(),null,5,List.of(),false));
        var candidate=new WorkerCandidate("read",null,kind.equals("candidateDate")?date.plusDays(1):date,
                LocalTime.parse(kind.equals("outside")?"10:00":"09:00"),kind.equals("budget")?6:kind.equals("invalid")?0:3);
        WorkerResponse response=kind.equals("null")?null:new WorkerResponse(kind.equals("date")?date.plusDays(1):date,
                kind.equals("empty")?List.of():kind.equals("duplicate")?List.of(candidate,candidate):List.of(candidate),List.of());
        when(worker.generate(any())).thenReturn(response);
        try(var factory=Validation.buildDefaultValidatorFactory()) {
            var service=new ScheduleGenerationService(reader,worker,factory.getValidator());
            assertThatThrownBy(()->service.generate(1L,new GenerateRequest(date,null,List.of(new Window(LocalTime.of(9,0),LocalTime.of(10,0))),null)))
                    .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        }
    }
}
