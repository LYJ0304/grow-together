package com.growtogether.report;

import com.growtogether.report.dto.WeeklyReportResponse;

import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/reports/weekly")
@RequiredArgsConstructor
public class WeeklyReportController {
    private final WeeklyReportService reports;
    @GetMapping
    public ResponseEntity<WeeklyReportResponse> get(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate weekStart) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(reports.get(Long.valueOf(jwt.getSubject()), weekStart));
    }
    @PostMapping("/insights")
    public ResponseEntity<WeeklyReportResponse> generate(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate weekStart) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(reports.generate(Long.valueOf(jwt.getSubject()), weekStart));
    }
}
