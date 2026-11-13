package com.growtogether.report;

import com.growtogether.report.dto.ReportActivity;
import com.growtogether.report.dto.ReportChildContext;
import com.growtogether.report.dto.ReportDaily;
import com.growtogether.report.dto.ReportEvidence;
import com.growtogether.report.dto.ReportEvidenceType;
import com.growtogether.report.dto.ReportInsight;
import com.growtogether.report.dto.ReportInsightState;
import com.growtogether.report.dto.ReportMetrics;
import com.growtogether.report.dto.ReportNextStep;
import com.growtogether.report.dto.ReportObservation;
import com.growtogether.report.dto.ReportPeriod;
import com.growtogether.report.dto.ReportWorkerMetrics;
import com.growtogether.report.dto.ReportWorkerPeriod;
import com.growtogether.report.dto.ReportWorkerRequest;
import com.growtogether.report.dto.ReportWorkerResponse;
import com.growtogether.report.dto.ReportWorkerResult;
import com.growtogether.report.dto.ReportWorkerSources;
import com.growtogether.report.dto.ReportWorkerTodo;
import com.growtogether.report.dto.WeeklyReportResponse;
import static com.growtogether.report.dto.ReportWorkerRequest.PROMPT_VERSION;

import java.time.*;
import java.util.*;

final class ReportTestData {
    static final LocalDate WEEK=LocalDate.of(2026,11,9);
    static final Instant NOW=Instant.parse("2026-11-11T03:00:00Z");
    static WeeklyReportReader.Snapshot snapshot(String hash) {
        var at=NOW.atOffset(ZoneOffset.ofHours(9));
        var daily=WEEK.datesUntil(WEEK.plusWeeks(1)).map(d->new ReportDaily(d,d.equals(WEEK)?1:0)).toList();
        var metrics=new ReportMetrics(1,1,1,0,1.0,daily);
        var report=new WeeklyReportResponse(new ReportPeriod(WEEK,WEEK.plusDays(6),WEEK.plusDays(7),at,true),metrics,
                List.of(new ReportActivity("그림책 읽기",1)),false,List.of(),hash,PROMPT_VERSION,ReportInsight.of(ReportInsightState.NOT_GENERATED,null));
        var input=new ReportWorkerRequest(hash,PROMPT_VERSION,new ReportWorkerPeriod(WEEK,WEEK.plusDays(6),WEEK.plusDays(7),at,true),
                new ReportWorkerMetrics(1,1,1,0,1.0,daily),new ReportChildContext(22,WEEK.plusDays(2),List.of("communication"),null),
                new ReportWorkerSources(List.of(new ReportWorkerTodo(10L,"그림책 읽기",WEEK,LocalTime.NOON,null)),List.of(),false));
        return new WeeklyReportReader.Snapshot(report,input,null);
    }
    static ReportWorkerResponse result(ReportWorkerRequest input) {
        var evidence=List.of(new ReportEvidence(ReportEvidenceType.TODO,10L));
        return new ReportWorkerResponse(input.sourceHash(),PROMPT_VERSION,new ReportWorkerResult("함께한 활동을 기록했어요.",
                List.of(new ReportObservation("그림책 읽기",evidence)),
                List.of(new ReportNextStep("그림책 함께 보기","부담 없이 책을 펼쳐보세요.","기록한 활동을 이어가는 제안이에요.",evidence))));
    }
}
