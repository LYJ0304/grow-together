package com.growtogether.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.growtogether.auth.AuthRepository;
import com.growtogether.user.User;
import com.jayway.jsonpath.JsonPath;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class FileIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private StoredFileRepository files;
    @Autowired private AuthRepository users;
    @MockitoBean private StorageService storage;

    @Test
    void registersPendingFileAndPersistsCompletionAfterVerification() throws Exception {
        Long owner = user();
        given(storage.createUploadUrl(any(), any())).willReturn("https://example.com/upload");
        String body = mvc.perform(post("/api/files/presigned-url").with(jwt().jwt(token -> token.subject(owner.toString())))
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"filename":"photo.png","contentType":"image/png","fileSize":1234}
                                """))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID id = UUID.fromString(JsonPath.read(body, "$.fileId"));
        StoredFile pending = files.findById(id).orElseThrow();
        assertThat(pending.getStatus()).isEqualTo(FileStatus.PENDING);
        assertThat(pending.getOwnerId()).isEqualTo(owner);
        assertThat(pending.getCreatedAt()).isNotNull();
        assertThat(pending.getObjectKey()).isEqualTo(JsonPath.read(body, "$.objectKey"));
        given(storage.getMetadata(pending.getObjectKey())).willReturn(new StorageObjectMetadata(1234, "image/png"));

        mvc.perform(post("/api/files/{id}/complete", id).with(jwt().jwt(token -> token.subject(owner.toString()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"));

        files.flush();
        StoredFile completed = files.findById(id).orElseThrow();
        assertThat(completed.getStatus()).isEqualTo(FileStatus.COMPLETED);
        assertThat(completed.getCompletedAt()).isNotNull();
    }

    @Test
    void anotherUserCannotCompleteTheFile() throws Exception {
        Long owner = user();
        StoredFile file = files.saveAndFlush(new StoredFile(owner, "files/" + UUID.randomUUID(),
                "photo.png", "image/png", 1234L));
        mvc.perform(post("/api/files/{id}/complete", file.getId())
                        .with(jwt().jwt(token -> token.subject(Long.toString(owner + 1000)))))
                .andExpect(status().isNotFound());
        then(storage).shouldHaveNoInteractions();
    }

    @Test
    void mismatchedUploadRemainsPending() throws Exception {
        Long owner = user();
        StoredFile file = files.saveAndFlush(new StoredFile(owner, "files/" + UUID.randomUUID(),
                "photo.png", "image/png", 1234L));
        given(storage.getMetadata(file.getObjectKey())).willReturn(new StorageObjectMetadata(5000, "image/png"));
        mvc.perform(post("/api/files/{id}/complete", file.getId())
                        .with(jwt().jwt(token -> token.subject(owner.toString()))))
                .andExpect(status().isBadRequest());
        assertThat(files.findById(file.getId()).orElseThrow().getStatus()).isEqualTo(FileStatus.PENDING);
    }

    private Long user() {
        return users.saveAndFlush(new User("File owner", UUID.randomUUID() + "@example.com", "test-hash")).getId();
    }
}
