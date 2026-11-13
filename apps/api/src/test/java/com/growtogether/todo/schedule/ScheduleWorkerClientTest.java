package com.growtogether.todo.schedule;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static com.growtogether.todo.schedule.ScheduleDtos.*;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
class ScheduleWorkerClientTest {
    @Test void rejectsTimeoutsOutsideEndToEndDeadline() {
        assertThatThrownBy(()->new ScheduleWorkerClient("http://worker","key",1,30)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->new ScheduleWorkerClient("http://worker","key",10,35)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void mapsConnectionAndTimeoutFailures() {
        for (var timeout : List.of(false,true)) {
            var builder=RestClient.builder().baseUrl("http://worker");
            var server=MockRestServiceServer.bindTo(builder).build();
            server.expect(requestTo("http://worker/internal/v1/schedule/generate"))
                    .andRespond(withException(timeout?new java.net.http.HttpTimeoutException("private"):new java.net.ConnectException("private")));
            assertThatThrownBy(()->new ScheduleWorkerClient(builder.build(),"key").generate(new WorkerRequest(LocalDate.of(2026,11,10),"play",List.of(),List.of(),5,null,List.of(),false)))
                    .isInstanceOfSatisfying(ResponseStatusException.class,e->assertThat(e.getStatusCode().value()).isEqualTo(timeout?504:503));
        }
    }
    @Test void usesCurrentWorkerPathKeyAndSnakeCaseContract() {
        var builder = RestClient.builder().baseUrl("http://worker");
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("http://worker/internal/v1/schedule/generate"))
                .andExpect(header("X-API-Key","test-key"))
                .andExpect(jsonPath("$.max_candidates").value(5))
                .andExpect(jsonPath("$.available_windows[0].start").value("09:00:00"))
                .andExpect(jsonPath("$.available_windows[0].ordered").doesNotExist())
                .andRespond(withSuccess("{\"date\":\"2026-11-10\",\"candidates\":[],\"unscheduled\":[]}",MediaType.APPLICATION_JSON));
        var request = new WorkerRequest(LocalDate.of(2026,11,10),"play",
                List.of(new Window(LocalTime.of(9,0),LocalTime.of(10,0))),List.of(),5,null,List.of(),false);
        assertThat(new ScheduleWorkerClient(builder.build(),"test-key").generate(request).date()).isEqualTo(request.date());
        server.verify();
    }
    @Test void mapsUpstreamFailuresWithoutLeakingContent() {
        for (var pair : List.of(new int[]{422,502},new int[]{500,502},new int[]{504,504},new int[]{401,502})) {
            var builder = RestClient.builder().baseUrl("http://worker");
            var server = MockRestServiceServer.bindTo(builder).build();
            server.expect(requestTo("http://worker/internal/v1/schedule/generate"))
                    .andRespond(withStatus(HttpStatus.valueOf(pair[0])).body("private provider data"));
            assertThatThrownBy(() -> new ScheduleWorkerClient(builder.build(),"key").generate(new WorkerRequest(LocalDate.of(2026,11,10),"play",List.of(),List.of(),5,null,List.of(),false)))
                    .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                        assertThat(e.getStatusCode().value()).isEqualTo(pair[1]);
                        assertThat(e.getReason()).doesNotContain("private");
                    });
        }
    }
    @Test void feedbackWireMatchesSharedFixture() throws Exception {
        var request=new WorkerRequest(LocalDate.of(2026,11,13),"play",
                List.of(new Window(LocalTime.of(9,0),LocalTime.of(10,0))),List.of(),5,null,
                List.of(new Feedback(7L,"그림책 읽기",LocalDate.of(2026,11,12),com.growtogether.todo.ChildReaction.ENJOYED)),false);
        var mapper=tools.jackson.databind.json.JsonMapper.builder().build();
        assertThat(mapper.readTree(mapper.writeValueAsString(request))).isEqualTo(mapper.readTree(
                java.nio.file.Files.readString(java.nio.file.Path.of("../../contracts/fixtures/schedules/worker-request-feedback.json"))));
    }

}
