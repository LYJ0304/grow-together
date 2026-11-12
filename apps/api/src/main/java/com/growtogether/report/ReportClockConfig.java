package com.growtogether.report;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class ReportClockConfig {
    @Bean Clock reportClock() { return Clock.systemUTC(); }
}
