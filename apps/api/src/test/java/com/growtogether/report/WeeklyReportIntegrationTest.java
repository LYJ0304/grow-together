package com.growtogether.report;

import com.growtogether.report.dto.ReportEvidence;
import com.growtogether.report.dto.ReportEvidenceType;
import com.growtogether.report.dto.ReportNextStep;
import com.growtogether.report.dto.ReportObservation;
import com.growtogether.report.dto.ReportWorkerRequest;
import com.growtogether.report.dto.ReportWorkerResponse;
import com.growtogether.report.dto.ReportWorkerResult;
import static com.growtogether.report.dto.ReportWorkerRequest.PROMPT_VERSION;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import com.growtogether.child.ChildProfile;
import com.growtogether.child.ChildProfileRepository;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.growtogether.auth.AuthRepository;
import com.growtogether.user.User;
import com.growtogether.todo.Todo;
import com.growtogether.todo.TodoRepository;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import java.time.Clock;
import com.growtogether.diary.DiaryRepository;
import com.growtogether.diary.domain.Diary;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WeeklyReportIntegrationTest {
    @MockitoBean ReportWorkerClient worker;
    @MockitoBean Clock clock;
    @Autowired DiaryRepository diaries;
    @BeforeEach void fixedTime() { when(clock.instant()).thenReturn(ReportTestData.NOW); }
    @Autowired ChildProfileRepository children;
    @Autowired MockMvc mvc;
    @Autowired AuthRepository users;
    @Autowired TodoRepository todos;

    @Test
    void weeklyReadAggregatesOnlyOwnerDataWithoutWorker() throws Exception {
        var owner = users.saveAndFlush(new User("Owner", "report-owner@example.com", "test-hash"));
        var other = users.saveAndFlush(new User("Other", "report-other@example.com", "test-hash"));
        var date = LocalDate.of(2026, 1, 5);
        var todo = new Todo(owner.getId(), "그림책 읽기", "함께 읽어요", date, LocalTime.NOON);
        todo.setCompleted(true);
        todos.saveAndFlush(todo);
        todos.saveAndFlush(new Todo(other.getId(), "Private", null, date, LocalTime.NOON));
        mvc.perform(get("/api/v1/reports/weekly").param("weekStart", date.toString())
                        .with(jwt().jwt(j -> j.subject(owner.getId().toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.metrics.planned").value(1))
                .andExpect(jsonPath("$.metrics.completed").value(1))
                .andExpect(jsonPath("$.metrics.completionRate").value(1.0))
                .andExpect(jsonPath("$.majorActivities[0].title").value("그림책 읽기"));
        assertThat(todos.findById(todo.getId()).orElseThrow().isCompleted()).isTrue();
        verifyNoInteractions(worker);
    }
    @Test
    void explicitGenerationUsesCurrentEvidenceAndCachesOnlyValidatedResult() throws Exception {
        var owner=users.saveAndFlush(new User("Parent","generate-report@example.com","test-hash"));
        children.saveAndFlush(new ChildProfile(owner.getId(),"아이",LocalDate.of(2025,1,1)));
        var date=LocalDate.of(2026,1,5);
        var todo=new Todo(owner.getId(),"그림책 읽기",null,date,LocalTime.NOON);todo.setCompleted(true);
        todos.saveAndFlush(todo);
        when(worker.generate(any())).thenAnswer(invocation -> {
            ReportWorkerRequest input=invocation.getArgument(0);
            var evidence=List.of(new ReportEvidence(ReportEvidenceType.TODO,todo.getId()));
            return new ReportWorkerResponse(input.sourceHash(),PROMPT_VERSION,new ReportWorkerResult("함께한 활동을 기록했어요.",
                    List.of(new ReportObservation("그림책 읽기",evidence)),
                    List.of(new ReportNextStep("그림책 함께 보기","부담 없이 책을 펼쳐보세요.","기록한 활동을 이어가는 제안이에요.",evidence))));
        });
        for(int i=0;i<2;i++) mvc.perform(post("/api/v1/reports/weekly/insights")
                .param("weekStart",date.toString()).with(jwt().jwt(j->j.subject(owner.getId().toString()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.insight.state").value("AVAILABLE"))
                .andExpect(jsonPath("$.insight.result.nextSteps[0].title").value("그림책 함께 보기"));
        verify(worker,times(1)).generate(any());
        todo.update("다른 활동",null,date,LocalTime.NOON);todos.saveAndFlush(todo);
        mvc.perform(get("/api/v1/reports/weekly").param("weekStart",date.toString())
                .with(jwt().jwt(j->j.subject(owner.getId().toString()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.insight.state").value("STALE"))
                .andExpect(jsonPath("$.insight.result").isEmpty());
    }

    @Test
    void databaseChangeDuringGenerationDiscardsResultAndDeletionInvalidatesCache() throws Exception {
        var owner=users.saveAndFlush(new User("Parent","report-race@example.com","test-hash"));
        children.saveAndFlush(new ChildProfile(owner.getId(),"아이",LocalDate.of(2025,1,1)));
        var date=ReportTestData.WEEK;
        var todo=new Todo(owner.getId(),"그림책 읽기",null,date,LocalTime.NOON);todo.setCompleted(true);todos.saveAndFlush(todo);
        when(worker.generate(any())).thenAnswer(invocation -> {
            ReportWorkerRequest input=invocation.getArgument(0);
            todo.update("수정한 활동",null,date,LocalTime.NOON);todos.saveAndFlush(todo);
            var evidence=List.of(new ReportEvidence(ReportEvidenceType.TODO,todo.getId()));
            return new ReportWorkerResponse(input.sourceHash(),PROMPT_VERSION,new ReportWorkerResult("함께한 활동을 기록했어요.",
                    List.of(new ReportObservation("그림책 읽기",evidence)),
                    List.of(new ReportNextStep("다시 함께하기","부담 없이 이어가세요.","기록에 바탕을 둔 제안이에요.",evidence))));
        });
        mvc.perform(post("/api/v1/reports/weekly/insights").param("weekStart",date.toString())
                .with(jwt().jwt(j->j.subject(owner.getId().toString()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.insight.state").value("STALE"))
                .andExpect(jsonPath("$.insight.result").isEmpty())
                .andExpect(jsonPath("$.majorActivities[0].title").value("수정한 활동"));
        todos.deleteById(todo.getId());
        mvc.perform(get("/api/v1/reports/weekly").param("weekStart",date.toString())
                .with(jwt().jwt(j->j.subject(owner.getId().toString()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.metrics.planned").value(0))
                .andExpect(jsonPath("$.insight.state").value("INSUFFICIENT_EVIDENCE"));
    }
    @Test
    void legacyDiariesStayUndatedAndWorkerTimeoutDoesNotBreakStatistics() throws Exception {
        var owner=users.saveAndFlush(new User("Parent","report-timeout@example.com","test-hash"));
        children.saveAndFlush(new ChildProfile(owner.getId(),"아이",LocalDate.of(2025,1,1)));
        diaries.saveAndFlush(new Diary(owner.getId(),"날짜 없는 과거 기록"));
        diaries.saveAndFlush(new Diary(owner.getId(),ReportTestData.WEEK,"오늘의 실제 기록"));
        when(worker.generate(any())).thenThrow(new ReportGenerationException("TIMEOUT"));
        mvc.perform(post("/api/v1/reports/weekly/insights").param("weekStart",ReportTestData.WEEK.toString())
                .with(jwt().jwt(j->j.subject(owner.getId().toString()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.metrics.diaryDays").value(1))
                .andExpect(jsonPath("$.insight.reason").value("TIMEOUT"))
                .andExpect(jsonPath("$.memories.length()").value(1));
        mvc.perform(get("/api/v1/reports/weekly").param("weekStart",ReportTestData.WEEK.toString())
                .with(jwt().jwt(j->j.subject(owner.getId().toString()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.memories[0].excerpt").value("오늘의 실제 기록"));
        verify(worker,times(1)).generate(any());
    }

    @Test
    void diaryAndProfileEditsInvalidateCurrentSourceIncludingUnsampledText() throws Exception {
        var owner=users.saveAndFlush(new User("Parent","report-edits@example.com","test-hash"));
        var profile=children.saveAndFlush(new ChildProfile(owner.getId(),"아이",LocalDate.of(2025,1,1)));
        var diary=diaries.saveAndFlush(new Diary(owner.getId(),ReportTestData.WEEK,"기억".repeat(200)));
        when(worker.generate(any())).thenAnswer(invocation -> {
            ReportWorkerRequest input=invocation.getArgument(0);
            var evidence=List.of(new ReportEvidence(ReportEvidenceType.DIARY,diary.getId()));
            return new ReportWorkerResponse(input.sourceHash(),PROMPT_VERSION,new ReportWorkerResult("남겨둔 기록을 돌아봐요.",
                    List.of(new ReportObservation(input.sources().diaries().getFirst().excerpt(),evidence)),
                    List.of(new ReportNextStep("함께 기록하기","오늘의 장면을 남겨보세요.","남겨둔 기록에서 이어지는 제안이에요.",evidence))));
        });
        mvc.perform(post("/api/v1/reports/weekly/insights").param("weekStart",ReportTestData.WEEK.toString())
                .with(jwt().jwt(j->j.subject(owner.getId().toString()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.insight.state").value("AVAILABLE"));
        diary.updateContent("기억".repeat(200)+"바뀐 뒷부분");diaries.saveAndFlush(diary);
        mvc.perform(get("/api/v1/reports/weekly").param("weekStart",ReportTestData.WEEK.toString())
                .with(jwt().jwt(j->j.subject(owner.getId().toString()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.insight.state").value("STALE"));
        mvc.perform(post("/api/v1/reports/weekly/insights").param("weekStart",ReportTestData.WEEK.toString())
                .with(jwt().jwt(j->j.subject(owner.getId().toString()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.insight.state").value("AVAILABLE"));
        profile.replacePersonalization(null,null,List.of("communication"),"5min");children.saveAndFlush(profile);
        mvc.perform(get("/api/v1/reports/weekly").param("weekStart",ReportTestData.WEEK.toString())
                .with(jwt().jwt(j->j.subject(owner.getId().toString()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.insight.state").value("STALE"))
                .andExpect(jsonPath("$.insight.result").isEmpty());
        diaries.deleteById(diary.getId());
        mvc.perform(get("/api/v1/reports/weekly").param("weekStart",ReportTestData.WEEK.toString())
                .with(jwt().jwt(j->j.subject(owner.getId().toString()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.metrics.diaryDays").value(0))
                .andExpect(jsonPath("$.insight.state").value("INSUFFICIENT_EVIDENCE"));
    }

}
