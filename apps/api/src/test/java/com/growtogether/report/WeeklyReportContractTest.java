package com.growtogether.report;

import com.growtogether.report.dto.ReportInsight;
import com.growtogether.report.dto.ReportInsightState;
import com.growtogether.report.dto.ReportWorkerResponse;

import static org.assertj.core.api.Assertions.*;
import static com.growtogether.report.ReportTestData.*;
import java.nio.file.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class WeeklyReportContractTest {
    final JsonMapper mapper=JsonMapper.builder().build();
    final Path fixtures=Path.of("../../contracts/fixtures/reports");
    tools.jackson.databind.JsonNode wire(Object value) { return mapper.readTree(mapper.writeValueAsString(value)); }
    @Test void fixturesMatchActualWireNamesDatesAndDtoRoundTrips() throws Exception {
        var source=snapshot("a".repeat(64));
        assertThat(wire(source.input())).isEqualTo(mapper.readTree(Files.readString(fixtures.resolve("worker-request.json"))));
        var generated=result(source.input());
        assertThat(wire(generated)).isEqualTo(mapper.readTree(Files.readString(fixtures.resolve("worker-response.json"))));
        assertThat(wire(source.with(new ReportInsight(ReportInsightState.AVAILABLE,null,generated.result().external()))))
                .isEqualTo(mapper.readTree(Files.readString(fixtures.resolve("weekly-available.json"))));
        assertThat(mapper.readValue(Files.readString(fixtures.resolve("worker-response.json")),ReportWorkerResponse.class)).isEqualTo(generated);
    }
}
