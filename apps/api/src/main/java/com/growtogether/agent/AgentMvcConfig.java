package com.growtogether.agent;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.AsyncSupportConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class AgentMvcConfig implements WebMvcConfigurer {
    @Override
    public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
        // The worker run has its own shorter limit; MVC must not end it at the default 30s.
        configurer.setDefaultTimeout(130_000);
    }
}
