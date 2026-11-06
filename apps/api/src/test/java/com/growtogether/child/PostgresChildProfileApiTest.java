package com.growtogether.child;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.growtogether.auth.AuthRepository;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = {
        "spring.datasource.driver-class-name=org.postgresql.Driver",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@Testcontainers(disabledWithoutDocker = true)
class PostgresChildProfileApiTest extends ChildProfileIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private ChildProfileRepository profiles;
    @Autowired private AuthRepository users;
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void create_동시등록시하나만성공하고나머지는409반환() throws Exception {
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> createTogether("하늘", ready, start));
            var second = executor.submit(() -> createTogether("바다", ready, start));
            try {
                assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            } finally {
                start.countDown();
            }
            int firstStatus = first.get(20, TimeUnit.SECONDS);
            int secondStatus = second.get(20, TimeUnit.SECONDS);
            assertThat(new int[] {firstStatus, secondStatus})
                    .containsExactlyInAnyOrder(201, 409);
            assertThat(profiles.findAll()).hasSize(1);
            assertThat(profiles.findById(ownerId).orElseThrow().getName())
                    .isEqualTo(firstStatus == 201 ? "하늘" : "바다");
        } finally {
            profiles.deleteById(ownerId);
            users.deleteById(ownerId);
            users.deleteById(otherId);
        }
    }

    private int createTogether(String name, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
        return mvc.perform(post("/api/v1/children/me")
                        .with(jwt().jwt(token -> token.subject(ownerId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"%s\",\"birthday\":\"2024-03-15\"}".formatted(name)))
                .andReturn().getResponse().getStatus();
    }
}
