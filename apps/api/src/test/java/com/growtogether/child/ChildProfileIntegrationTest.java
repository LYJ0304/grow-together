package com.growtogether.child;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.growtogether.auth.AuthRepository;
import com.growtogether.user.User;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ChildProfileIntegrationTest {
    private static final String PATH = "/api/v1/children/me";
    @Autowired private MockMvc mvc;
    @Autowired private AuthRepository users;
    @Autowired private EntityManager entityManager;
    private Long ownerId;
    private Long otherId;

    @BeforeEach
    void setUp() {
        ownerId = users.save(new User("Owner", "child-owner@example.com", "unused-test-hash")).getId();
        otherId = users.save(new User("Other", "child-other@example.com", "unused-test-hash")).getId();
    }

    @Test
    void missingProfileReturns404() throws Exception {
        read(ownerId).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void createsReadsAndReplacesOwnProfile() throws Exception {
        save(ownerId, body("  하늘  ", "2024-03-15"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("하늘"))
                .andExpect(jsonPath("$.birthday").value("2024-03-15"));
        read(ownerId).andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("하늘"))
                .andExpect(jsonPath("$.birthday").value("2024-03-15"))
                .andExpect(jsonPath("$.userId").doesNotExist());
        save(ownerId, body("바다", "2024-02-29")).andExpect(status().isOk());
        save(ownerId, body("바다", "2024-02-29")).andExpect(status().isOk());
        read(ownerId).andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("바다"))
                .andExpect(jsonPath("$.birthday").value("2024-02-29"));
    }

    @Test
    void profilesAreIsolatedByAuthenticatedUserEvenWithSuppliedOwnerId() throws Exception {
        save(ownerId, body("하늘", "2024-03-15")).andExpect(status().isOk());
        read(otherId).andExpect(status().isNotFound());
        save(otherId, """
                {"name":"바다","birthday":"2023-01-01","userId":%d}
                """.formatted(ownerId)).andExpect(status().isOk());
        read(ownerId).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("하늘"));
        read(otherId).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("바다"));
    }

    @Test
    void requiresAuthenticationForReadAndSave() throws Exception {
        mvc.perform(get(PATH)).andExpect(status().isUnauthorized());
        mvc.perform(put(PATH).contentType(MediaType.APPLICATION_JSON).content(body("하늘", "2024-03-15")))
                .andExpect(status().isUnauthorized());
        read(ownerId).andExpect(status().isNotFound());
    }

    @Test
    void acceptsNameBoundaryAndToday() throws Exception {
        save(ownerId, body("  " + "가".repeat(50) + "  ", LocalDate.now().toString())).andExpect(status().isOk());
        read(ownerId).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("가".repeat(50)));
    }

    @Test
    void acceptsEarliestSupportedBirthday() throws Exception {
        save(ownerId, body("하늘", "0001-01-01")).andExpect(status().isOk())
                .andExpect(jsonPath("$.birthday").value("0001-01-01"));
        read(ownerId).andExpect(status().isOk()).andExpect(jsonPath("$.birthday").value("0001-01-01"));
    }

    @Test
    void rejectsInvalidFieldsAndPreservesExistingProfile() throws Exception {
        save(ownerId, body("하늘", "2024-03-15")).andExpect(status().isOk());
        for (String request : new String[] {
                "{}", "{", "null", "{\"name\":\"하늘\"}", "{\"birthday\":\"2024-03-15\"}",
                body("", "2024-03-15"), body("   ", "2024-03-15"),
                body("가".repeat(51), "2024-03-15"),
                body("하늘", LocalDate.now().plusDays(1).toString()),
                body("하늘", "2023-02-29"), body("하늘", "2024-02-30"),
                body("하늘", "0000-01-01"), body("하늘", "-0001-01-01"),
                body("하늘", "2024-3-15"), body("하늘", ""),
                "{\"name\":null,\"birthday\":\"2024-03-15\"}",
                "{\"name\":\"하늘\",\"birthday\":null}"
        }) {
            save(ownerId, request).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        }
        read(ownerId).andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("하늘"))
                .andExpect(jsonPath("$.birthday").value("2024-03-15"));
    }

    private ResultActions read(Long userId) throws Exception {
        entityManager.flush();
        entityManager.clear();
        return mvc.perform(get(PATH).with(jwt().jwt(token -> token.subject(userId.toString()))));
    }

    private ResultActions save(Long userId, String body) throws Exception {
        return mvc.perform(put(PATH).with(jwt().jwt(token -> token.subject(userId.toString())))
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private static String body(String name, String birthday) {
        return "{\"name\":\"%s\",\"birthday\":\"%s\"}".formatted(name, birthday);
    }
}
