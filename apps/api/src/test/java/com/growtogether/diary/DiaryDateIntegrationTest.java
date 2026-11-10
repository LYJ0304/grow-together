package com.growtogether.diary;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.growtogether.auth.AuthRepository;
import com.growtogether.user.User;
import com.growtogether.todo.TodoRepository;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DiaryDateIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired AuthRepository users;
    @Autowired DiaryRepository diaries;
    @Autowired TodoRepository todos;
    long owner;
    long other;
    @BeforeEach void setup() {
        todos.deleteAll(); diaries.deleteAll(); users.deleteAll();
        owner = users.save(new User("Owner", "date-owner@example.com", "hash")).getId();
        other = users.save(new User("Other", "date-other@example.com", "hash")).getId();
    }
    String body(String date) {
        return "{\"diaryDate\":\""+date+"\",\"content\":\"record\",\"todoIds\":[],\"diaryFiles\":[]}";
    }
    long create(long user, String date) throws Exception {
        String response = mvc.perform(post("/api/v1/diary").with(jwt().jwt(t -> t.subject(""+user)))
            .contentType(MediaType.APPLICATION_JSON).content(body(date)))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.diaryDate").value(date))
            .andReturn().getResponse().getContentAsString();
        return ((Number)JsonPath.read(response,"$.id")).longValue();
    }
    @Test void monthIsSortedBoundedAndOwnerScoped() throws Exception {
        create(owner,"2024-02-29"); create(owner,"2024-02-01");
        create(owner,"2024-01-31"); create(owner,"2024-03-01"); create(other,"2024-02-02");
        mvc.perform(get("/api/v1/diary?month=2024-02").with(jwt().jwt(t -> t.subject(""+owner))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].diaryDate").value("2024-02-01"))
            .andExpect(jsonPath("$[1].diaryDate").value("2024-02-29"))
            .andExpect(jsonPath("$[0].content").doesNotExist());
        mvc.perform(get("/api/v1/diary?month=2024-04").with(jwt().jwt(t -> t.subject(""+owner))))
            .andExpect(status().isOk()).andExpect(content().json("[]"));
    }
    @Test void lookupUpdateDuplicateDeleteAndRecreate() throws Exception {
        long id=create(owner,"2026-11-10");
        mvc.perform(post("/api/v1/diary").with(jwt().jwt(t -> t.subject(""+owner)))
            .contentType(MediaType.APPLICATION_JSON).content(body("2026-11-10")))
            .andExpect(status().isConflict());
        create(other,"2026-11-10");
        mvc.perform(get("/api/v1/diary/by-date?date=2026-11-10").with(jwt().jwt(t -> t.subject(""+owner))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        mvc.perform(put("/api/v1/diary/"+id).with(jwt().jwt(t -> t.subject(""+owner)))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"content\":\"updated\",\"todoIds\":[],\"diaryFiles\":[]}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.diaryDate").value("2026-11-10"));
        mvc.perform(delete("/api/v1/diary/"+id).with(jwt().jwt(t -> t.subject(""+owner))))
            .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/diary/by-date?date=2026-11-10").with(jwt().jwt(t -> t.subject(""+owner))))
            .andExpect(status().isNotFound());
        create(owner,"2026-11-10");
    }
    @Test void legacyDiaryRemainsAccessibleByIdAndUndatedAfterUpdate() throws Exception {
        long id = diaries.saveAndFlush(new com.growtogether.diary.domain.Diary(owner, "Legacy")).getId();
        mvc.perform(get("/api/v1/diary/"+id).with(jwt().jwt(t -> t.subject(""+owner))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.diaryDate").isEmpty());
        mvc.perform(put("/api/v1/diary/"+id).with(jwt().jwt(t -> t.subject(""+owner)))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"content\":\"preserved\",\"todoIds\":[],\"diaryFiles\":[]}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.diaryDate").isEmpty());
        mvc.perform(get("/api/v1/diary?month=2026-11").with(jwt().jwt(t -> t.subject(""+owner))))
            .andExpect(status().isOk()).andExpect(content().json("[]"));
    }
    @Test void missingOtherOwnersDateAndInvalidDates() throws Exception {
        create(other,"2026-11-10");
        mvc.perform(get("/api/v1/diary/by-date?date=2026-11-10").with(jwt().jwt(t -> t.subject(""+owner))))
            .andExpect(status().isNotFound());
        for(String path : new String[]{"?month=2026-13","?month=2026-1","/by-date?date=2026-02-30","/by-date"}) {
            mvc.perform(get("/api/v1/diary"+path).with(jwt().jwt(t -> t.subject(""+owner))))
                .andExpect(status().isBadRequest());
        }
        mvc.perform(post("/api/v1/diary").with(jwt().jwt(t -> t.subject(""+owner)))
            .contentType(MediaType.APPLICATION_JSON).content(body("2026-02-30")))
            .andExpect(status().isBadRequest());
        assertThat(diaries.count()).isEqualTo(1);
    }
}
