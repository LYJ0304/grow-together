package com.growtogether.todo.schedule;
import static org.assertj.core.api.Assertions.*;
import static com.growtogether.todo.schedule.ScheduleDtos.*;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
class ScheduleRulesTest {
    Candidate candidate(String name, String time, int minutes) {
        return new Candidate(name, null, LocalTime.parse(time), minutes);
    }
    @Test void validatesWholeBudgetIncludingUnscheduled() {
        var context = new Context(List.of(), null, 5, List.of(), false);
        assertThatThrownBy(() -> ScheduleRules.validate(List.of(candidate("read","09:00",3)),
                List.of(new Unscheduled("play",null,3)), context, null, 5, HttpStatus.BAD_GATEWAY));
        ScheduleRules.validate(List.of(candidate("read","09:00",3)),
                List.of(new Unscheduled("play",null,2)), context, null, 5, HttpStatus.BAD_GATEWAY);
    }
    @Test void rejectsOverlapsAndMergesTouchingWindows() {
        var context = new Context(List.of(new Existing(1L,"meal",LocalTime.of(9,0),30)),null,null,List.of(),false);
        var windows = List.of(new Window(LocalTime.of(9,0),LocalTime.of(10,0)),
                new Window(LocalTime.of(10,0),LocalTime.of(11,0)));
        ScheduleRules.validate(List.of(candidate("read","09:30",60)),List.of(),context,windows,5,HttpStatus.BAD_GATEWAY);
        assertThatThrownBy(() -> ScheduleRules.validate(List.of(candidate("read","09:29",5)),List.of(),context,windows,5,HttpStatus.BAD_GATEWAY));
        assertThatThrownBy(() -> ScheduleRules.validate(List.of(candidate("read","23:59",2)),List.of(),new Context(List.of(),null,null,List.of(),false),null,5,HttpStatus.CONFLICT));
    }
}
