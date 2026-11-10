package com.growtogether.child;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.growtogether.auth.AuthRepository;
import com.growtogether.user.User;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ChildPersonalizationIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired AuthRepository users;
    @Autowired EntityManager em;
    long owner, other;
    static final String PATH="/api/v1/children/me";
    static final String VALUES="""
        {"prematurityStatus":"yes","expectedDueDate":"2024-04-15",
         "concerns":["sleep","communication"],"availableActivityTime":"15to20min"}
        """;
    @BeforeEach void setup() {
        owner=users.save(new User("Owner","personal-owner@example.com","hash")).getId();
        other=users.save(new User("Other","personal-other@example.com","hash")).getId();
    }
    String body(String personalization) {
        return "{\"name\":\"Child\",\"birthday\":\"2024-03-15\""
            +(personalization==null?"":",\"personalization\":"+personalization)+"}";
    }
    void savePersonalization(String personalization) throws Exception {
        mvc.perform(put(PATH).with(jwt().jwt(t -> t.subject(""+owner)))
            .contentType(MediaType.APPLICATION_JSON).content(body(personalization))).andExpect(status().isOk());
        em.flush(); em.clear();
    }
    @Test void storesReloadsPreservesAndExplicitlyClears() throws Exception {
        mvc.perform(post(PATH).with(jwt().jwt(t -> t.subject(""+owner)))
            .contentType(MediaType.APPLICATION_JSON).content(body(VALUES)))
            .andExpect(status().isCreated());
        em.flush(); em.clear();
        for(String input:new String[]{null,"null"}) {
            savePersonalization(input);
            mvc.perform(get(PATH).with(jwt().jwt(t -> t.subject(""+owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.personalization.expectedDueDate").value("2024-04-15"))
                .andExpect(jsonPath("$.personalization.concerns[0]").value("sleep"))
                .andExpect(jsonPath("$.personalization.concerns[1]").value("communication"))
                .andExpect(jsonPath("$.personalization.availableActivityTime").value("15to20min"))
                .andExpect(jsonPath("$.personalization.developmentObservations").isEmpty());
        }
        savePersonalization("{}");
        mvc.perform(get(PATH).with(jwt().jwt(t -> t.subject(""+owner))))
            .andExpect(jsonPath("$.personalization.concerns").isEmpty())
            .andExpect(jsonPath("$.personalization.prematurityStatus").isEmpty())
            .andExpect(jsonPath("$.personalization.expectedDueDate").isEmpty());
    }
    @Test void isolatesUsersAndInvalidWritePreservesOldValues() throws Exception {
        savePersonalization(VALUES);
        mvc.perform(get(PATH).with(jwt().jwt(t -> t.subject(""+other))))
            .andExpect(status().isNotFound());
        mvc.perform(put(PATH).with(jwt().jwt(t -> t.subject(""+owner)))
            .contentType(MediaType.APPLICATION_JSON)
            .content(body("{\"concerns\":[\"none\",\"sleep\"]}")))
            .andExpect(status().isBadRequest());
        em.clear();
        mvc.perform(get(PATH).with(jwt().jwt(t -> t.subject(""+owner))))
            .andExpect(jsonPath("$.personalization.concerns[0]").value("sleep"));
    }
    @Test void acceptsFutureDueDateAndOptionalYesWithoutDueDate() throws Exception {
        savePersonalization("{\"prematurityStatus\":\"yes\",\"expectedDueDate\":\"2099-01-01\"}");
        savePersonalization("{\"prematurityStatus\":\"yes\"}");
        mvc.perform(get(PATH).with(jwt().jwt(t -> t.subject(""+owner))))
            .andExpect(jsonPath("$.personalization.expectedDueDate").isEmpty());
    }
    @Test void reordersAndReplacesConcernSelection() throws Exception {
        savePersonalization(VALUES);
        savePersonalization("{\"concerns\":[\"communication\",\"sleep\"]}");
        mvc.perform(get(PATH).with(jwt().jwt(t -> t.subject(""+owner))))
            .andExpect(jsonPath("$.personalization.concerns[0]").value("communication"))
            .andExpect(jsonPath("$.personalization.concerns[1]").value("sleep"));
        savePersonalization("{\"concerns\":[\"none\"]}");
        savePersonalization("{\"concerns\":null,\"developmentObservations\":null}");
        mvc.perform(get(PATH).with(jwt().jwt(t -> t.subject(""+owner))))
            .andExpect(jsonPath("$.personalization.concerns").isEmpty());
    }

    @Test void changingBirthdayCannotInvalidatePreservedDueDate() throws Exception {
        savePersonalization(VALUES);
        mvc.perform(put(PATH).with(jwt().jwt(t -> t.subject(""+owner)))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Changed\",\"birthday\":\"2024-05-01\"}"))
            .andExpect(status().isBadRequest());
        em.clear();
        mvc.perform(get(PATH).with(jwt().jwt(t -> t.subject(""+owner))))
            .andExpect(jsonPath("$.name").value("Child"))
            .andExpect(jsonPath("$.birthday").value("2024-03-15"))
            .andExpect(jsonPath("$.personalization.expectedDueDate").value("2024-04-15"));
    }
}
