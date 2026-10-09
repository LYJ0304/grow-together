package com.growtogether.common.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
class WebConfig implements WebMvcConfigurer {
    private final String[] allowedOrigins;
    WebConfig(@Value("${app.cors.allowed-origins:http://localhost:8081}") String origins) { this.allowedOrigins = origins.split(","); }
    @Override public void addCorsMappings(CorsRegistry registry) { registry.addMapping("/api/**").allowedOrigins(allowedOrigins).allowedMethods("GET", "POST", "PUT", "DELETE"); }
}
