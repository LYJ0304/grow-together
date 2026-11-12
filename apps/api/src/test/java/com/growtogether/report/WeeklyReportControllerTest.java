package com.growtogether.report;

import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.growtogether.common.config.SecurityConfig;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@WebMvcTest(WeeklyReportController.class)
@Import(SecurityConfig.class)
class WeeklyReportControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean WeeklyReportService reports;
    @MockitoBean JwtDecoder decoder;
    static final String PATH="/api/v1/reports/weekly";
    @Test void ownerComesFromJwtAndOptionalWeekPassesThrough() throws Exception {
        var report=ReportTestData.snapshot("a".repeat(64)).report();
        when(reports.get(42L,null)).thenReturn(report);
        mvc.perform(get(PATH).param("userId","99").with(jwt().jwt(j->j.subject("42"))))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
                .andExpect(jsonPath("$.metrics.completed").value(1)).andExpect(jsonPath("$.insight.state").value("NOT_GENERATED"));
        verify(reports).get(42L,null);
        when(reports.generate(42L,ReportTestData.WEEK)).thenReturn(report);
        mvc.perform(post(PATH+"/insights").param("weekStart",ReportTestData.WEEK.toString()).with(jwt().jwt(j->j.subject("42"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.period.start").value(ReportTestData.WEEK.toString()));
        verify(reports).generate(42L,ReportTestData.WEEK);
    }
    @ParameterizedTest @ValueSource(strings={"not-a-date","2026-02-30","2026-13-01"})
    void invalidDateFormatReturns400WithoutCallingService(String input) throws Exception {
        mvc.perform(get(PATH).param("weekStart",input).with(jwt().jwt(j->j.subject("42"))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        verifyNoInteractions(reports);
    }
    @Test void authenticationAndBusinessErrorsUseExistingResponses() throws Exception {
        mvc.perform(get(PATH)).andExpect(status().isUnauthorized());
        mvc.perform(post(PATH+"/insights")).andExpect(status().isUnauthorized());
        when(reports.get(42L,LocalDate.of(2026,11,10))).thenThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST,"월요일"));
        mvc.perform(get(PATH).param("weekStart","2026-11-10").with(jwt().jwt(j->j.subject("42"))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }
}
