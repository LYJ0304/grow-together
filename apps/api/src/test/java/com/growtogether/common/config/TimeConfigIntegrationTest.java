package com.growtogether.common.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class TimeConfigIntegrationTest {
    @Autowired private ApplicationContext context;

    @Test
    void productionConfigurationProvidesOneSharedUtcClock() {
        var clocks = context.getBeansOfType(Clock.class);
        assertThat(clocks).containsOnlyKeys("clock");
        assertThat(clocks.get("clock").getZone()).isEqualTo(ZoneOffset.UTC);
    }
}
