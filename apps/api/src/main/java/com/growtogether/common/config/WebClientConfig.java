package com.growtogether.common.config;

import io.netty.channel.ChannelOption;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

@Configuration
public class WebClientConfig {
    @Bean
    public WebClient aiWorkerWebClient(
            @Value("${ai.worker.baseurl}") String baseUrl,
            @Value("${ai.worker.api-key}") String apiKey,
            @Value("${ai.worker.connect-timeout:5s}") Duration connectTimeout,
            @Value("${ai.worker.response-timeout:120s}") Duration responseTimeout) {
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, Math.toIntExact(connectTimeout.toMillis()))
                .responseTimeout(responseTimeout);
        WebClient.Builder builder = WebClient.builder().baseUrl(baseUrl)
                .clientConnector(new ReactorClientHttpConnector(httpClient));
        if (StringUtils.hasText(apiKey)) {
            builder.defaultHeader("X-API-Key", apiKey);
        }
        return builder.build();
    }
}
