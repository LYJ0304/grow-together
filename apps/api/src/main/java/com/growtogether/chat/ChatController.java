package com.growtogether.chat;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ChatController {
    private final ChatWorkerClient worker;

    public ChatController(ChatWorkerClient worker) {
        this.worker = worker;
    }

    @PostMapping("/api/v1/chat/generate")
    public ResponseEntity<Reply> generate(@Valid @RequestBody Question question) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(worker.generate(question));
    }

    public record Question(@NotBlank @Size(max = 4000) String message,
            @Size(max = 20) List<@NotNull @Valid Turn> history) {
        public Question {
            if (history == null) history = List.of();
        }
    }

    public record Turn(@NotNull @Pattern(regexp = "user|assistant") String role,
            @NotBlank @Size(max = 4000) String content) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Reply(String content) {}
}
