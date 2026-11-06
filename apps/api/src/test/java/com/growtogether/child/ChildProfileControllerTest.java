package com.growtogether.child;

import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.growtogether.child.dto.ChildProfileRequest;
import com.growtogether.child.dto.ChildProfileResponse;
import com.growtogether.common.config.SecurityConfig;
import java.time.LocalDate;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(ChildProfileController.class)
@Import(SecurityConfig.class)
class ChildProfileControllerTest {
    private static final String PATH = "/api/v1/children/me";
    private final Long userId = 1L;
    private final LocalDate birthday = LocalDate.of(2024, 3, 15);
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private ChildProfileService service;
    @MockitoBean private JwtDecoder jwtDecoder;

    @Test
    void create_정상요청이면201반환() throws Exception {
        var input = new ChildProfileRequest("하늘", birthday);
        given(service.create(userId, input)).willReturn(new ChildProfileResponse(input.name(), birthday));

        mvc.perform(post(PATH).with(jwt().jwt(token -> token.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.name").value(input.name()))
                .andExpect(jsonPath("$.birthday").value(birthday.toString()));
        then(service).should().create(userId, input);
    }

    @ParameterizedTest
    @ValueSource(ints = {404, 409})
    void create_서비스오류상태와코드를반환(int statusCode) throws Exception {
        var input = new ChildProfileRequest("하늘", birthday);
        var httpStatus = HttpStatus.valueOf(statusCode);
        given(service.create(userId, input)).willThrow(new ResponseStatusException(httpStatus));

        mvc.perform(post(PATH).with(jwt().jwt(token -> token.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(input)))
                .andExpect(status().is(statusCode)).andExpect(jsonPath("$.code").value(httpStatus.name()));
    }

    @ParameterizedTest
    @MethodSource("allowedProfiles")
    void 등록수정시이름길이와생년월일경계값허용(ChildProfileRequest input) throws Exception {
        var response = new ChildProfileResponse(input.name(), input.birthday());
        given(service.create(userId, input)).willReturn(response);
        given(service.save(userId, input)).willReturn(response);

        for (String method : new String[] {"POST", "PUT"}) {
            mvc.perform(request(HttpMethod.valueOf(method), PATH)
                            .with(jwt().jwt(token -> token.subject(userId.toString())))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body("  " + input.name() + "  ", input.birthday().toString())))
                    .andExpect(status().is(method.equals("POST") ? 201 : 200))
                    .andExpect(jsonPath("$.name").value(input.name()))
                    .andExpect(jsonPath("$.birthday").value(input.birthday().toString()));
        }
        then(service).should().create(userId, input);
        then(service).should().save(userId, input);
    }

    @Test
    void get_정상요청이면200반환() throws Exception {
        given(service.get(userId)).willReturn(new ChildProfileResponse("하늘", birthday));

        mvc.perform(get(PATH).with(jwt().jwt(token -> token.subject(userId.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("하늘"))
                .andExpect(jsonPath("$.birthday").value("2024-03-15"))
                .andExpect(jsonPath("$.userId").doesNotExist());
        then(service).should().get(userId);
    }

    @Test
    void get_프로필이없으면404반환() throws Exception {
        given(service.get(userId)).willThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Child profile not found"));

        mvc.perform(get(PATH).with(jwt().jwt(token -> token.subject(userId.toString()))))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void save_공백을정리하고200반환() throws Exception {
        var input = new ChildProfileRequest("하늘", birthday);
        given(service.save(userId, input)).willReturn(new ChildProfileResponse(input.name(), birthday));

        mvc.perform(put(PATH).with(jwt().jwt(token -> token.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON).content(body("  하늘  ", birthday.toString())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("하늘"))
                .andExpect(jsonPath("$.birthday").value(birthday.toString()));
        then(service).should().save(userId, input);
    }

    @ParameterizedTest
    @ValueSource(strings = {"GET", "POST", "PUT"})
    void 인증이없으면401반환(String method) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(method), PATH).contentType(MediaType.APPLICATION_JSON)
                        .content(body("하늘", birthday.toString())))
                .andExpect(status().isUnauthorized());
        then(service).shouldHaveNoInteractions();
    }

    @ParameterizedTest
    @MethodSource("invalidRequests")
    void 잘못된등록수정요청이면400반환하고서비스를호출하지않음(String input) throws Exception {
        for (String method : new String[] {"POST", "PUT"}) {
            mvc.perform(request(HttpMethod.valueOf(method), PATH)
                            .with(jwt().jwt(token -> token.subject(userId.toString())))
                            .contentType(MediaType.APPLICATION_JSON).content(input))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        }
        then(service).shouldHaveNoInteractions();
    }

    @ParameterizedTest
    @ValueSource(strings = {"POST", "PUT"})
    void 지원하지않는ContentType이면415반환(String method) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(method), PATH)
                        .with(jwt().jwt(token -> token.subject(userId.toString())))
                        .contentType(MediaType.TEXT_PLAIN).content("invalid"))
                .andExpect(status().isUnsupportedMediaType());
        then(service).shouldHaveNoInteractions();
    }

    private static Stream<ChildProfileRequest> allowedProfiles() {
        return Stream.of(new ChildProfileRequest("가".repeat(50), LocalDate.now()),
                new ChildProfileRequest("가", LocalDate.of(1, 1, 1)));
    }

    private static Stream<String> invalidRequests() {
        return Stream.of(
                "{}", "{", "null", "{\"name\":\"하늘\"}", "{\"birthday\":\"2024-03-15\"}",
                body("", "2024-03-15"), body("   ", "2024-03-15"),
                body("가".repeat(51), "2024-03-15"),
                body("하늘", LocalDate.now().plusDays(1).toString()),
                body("하늘", "2023-02-29"), body("하늘", "2024-02-30"),
                body("하늘", "0000-01-01"), body("하늘", "-0001-01-01"),
                body("하늘", "2024-3-15"), body("하늘", ""),
                "{\"name\":null,\"birthday\":\"2024-03-15\"}",
                "{\"name\":\"하늘\",\"birthday\":null}"
        );
    }

    private static String body(String name, String birthday) {
        return "{\"name\":\"%s\",\"birthday\":\"%s\"}".formatted(name, birthday);
    }
}
