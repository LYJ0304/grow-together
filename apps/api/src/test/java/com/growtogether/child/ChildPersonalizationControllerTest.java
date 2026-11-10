package com.growtogether.child;

import static org.mockito.BDDMockito.then;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import com.growtogether.common.config.SecurityConfig;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ChildProfileController.class)
@Import(SecurityConfig.class)
class ChildPersonalizationControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean ChildProfileService service;
    @MockitoBean JwtDecoder decoder;

    @ParameterizedTest
    @ValueSource(strings = {
        "{\"unexpected\":true}",
        "{\"concerns\":\"sleep\"}",
        "{\"prematurityStatus\":\"\"}",
        "{\"prematurityStatus\":\"invalid\"}",
        "{\"concerns\":[\"sleep\",\"feeding\",\"communication\"]}",
        "{\"concerns\":[\"sleep\",\"sleep\"]}",
        "{\"concerns\":[\"none\",\"sleep\"]}",
        "{\"concerns\":[\"unknown_code\"]}",
        "{\"concerns\":[null]}",
        "{\"availableActivityTime\":\"30min\"}",
        "{\"prematurityStatus\":\"no\",\"expectedDueDate\":\"2024-04-01\"}",
        "{\"prematurityStatus\":\"yes\",\"expectedDueDate\":\"2024-03-01\"}",
        "{\"prematurityStatus\":\"yes\",\"expectedDueDate\":\"2024-03-15\"}",
        "{\"prematurityStatus\":\"yes\",\"expectedDueDate\":\"2024-02-30\"}",
        "{\"developmentObservations\":[{\"questionId\":\"unapproved\",\"answer\":\"yes\"}]}",
        "{\"developmentObservations\":[{\"questionId\":\"unapproved\",\"answer\":\"sometimes\"}]}"
    })
    void rejectsInvalidPersonalizationBeforeService(String personalization) throws Exception {
        mvc.perform(post("/api/v1/children/me").with(jwt().jwt(t -> t.subject("1")))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Child\",\"birthday\":\"2024-03-15\",\"personalization\":"+personalization+"}"))
            .andExpect(status().isBadRequest());
        then(service).shouldHaveNoInteractions();
    }
}
