package com.growtogether.report;

import java.time.*;
import java.util.*;
import static com.growtogether.report.ReportDtos.*;

final class ReportTestData {
    static final LocalDate WEEK=LocalDate.of(2026,11,9);
    static final Instant NOW=Instant.parse("2026-11-11T03:00:00Z");
    static WeeklyReportReader.Snapshot snapshot(String hash) {
        var at=NOW.atOffset(ZoneOffset.ofHours(9));
        var daily=WEEK.datesUntil(WEEK.plusWeeks(1)).map(d->new Daily(d,d.equals(WEEK)?1:0)).toList();
        var metrics=new Metrics(1,1,1,0,1.0,daily);
        var report=new WeeklyReport(new ReportDtos.Period(WEEK,WEEK.plusDays(6),WEEK.plusDays(7),at,true),metrics,
                List.of(new Activity("그림책 읽기",1)),false,List.of(),hash,PROMPT_VERSION,Insight.of(State.NOT_GENERATED,null));
        var input=new WorkerRequest(hash,PROMPT_VERSION,new WorkerPeriod(WEEK,WEEK.plusDays(6),WEEK.plusDays(7),at,true),
                new WorkerMetrics(1,1,1,0,1.0,daily),new Child(22,WEEK.plusDays(2),List.of("communication"),null),
                new Sources(List.of(new WorkerTodo(10L,"그림책 읽기",WEEK,LocalTime.NOON)),List.of(),false));
        return new WeeklyReportReader.Snapshot(report,input,null);
    }
    static WorkerResponse result(WorkerRequest input) {
        var evidence=List.of(new Evidence(EvidenceType.TODO,10L));
        return new WorkerResponse(input.sourceHash(),PROMPT_VERSION,new WorkerResult("함께한 활동을 기록했어요.",
                List.of(new Observation("그림책 읽기",evidence)),
                List.of(new NextStep("그림책 함께 보기","부담 없이 책을 펼쳐보세요.","기록한 활동을 이어가는 제안이에요.",evidence))));
    }
}
