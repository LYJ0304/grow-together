package com.growtogether.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import java.util.Set;

@Configuration
public class SecurityConfig {
    private static final Set<String> AUTH_ENDPOINTS = Set.of("/api/v1/auth/signup", "/api/v1/auth/login",
            "/api/v1/auth/refresh", "/api/v1/auth/logout");

    @Bean
    PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        DefaultBearerTokenResolver bearerTokens = new DefaultBearerTokenResolver();
        return http.csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .httpBasic(AbstractHttpConfigurer::disable).formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(requests -> requests
                        .requestMatchers(HttpMethod.POST, AUTH_ENDPOINTS.toArray(String[]::new)).permitAll()
                        .requestMatchers("/api/health", "/actuator/health").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(resource -> resource.jwt(Customizer.withDefaults())
                        // Refresh/logout are authenticated by their body token, even if the access JWT has expired.
                        .bearerTokenResolver(request -> {
                            String path = request.getRequestURI().substring(request.getContextPath().length());
                            return "POST".equals(request.getMethod()) && AUTH_ENDPOINTS.contains(path)
                                    ? null : bearerTokens.resolve(request);
                        })
                        .authenticationEntryPoint((request, response, error) -> unauthorized(response)))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, error) -> unauthorized(response))
                        .accessDeniedHandler((request, response, error) -> {
                            response.setStatus(403);
                            response.setContentType("application/json");
                            response.getWriter().write("{\"code\":\"FORBIDDEN\",\"message\":\"Access denied\"}");
                        })).build();
    }

    private static void unauthorized(jakarta.servlet.http.HttpServletResponse response) throws java.io.IOException {
        response.setStatus(401);
        response.setHeader("WWW-Authenticate", "Bearer");
        response.setContentType("application/json");
        response.getWriter().write("{\"code\":\"UNAUTHORIZED\",\"message\":\"Authentication required\"}");
    }
}
