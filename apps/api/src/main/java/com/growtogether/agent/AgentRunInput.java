package com.growtogether.agent;

import java.util.List;
import java.util.Map;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

/** The supported text-only subset of AG-UI RunAgentInput. */
public record AgentRunInput(
        @NotBlank @Size(max = 64) String threadId,
        @NotBlank @Size(max = 64) String runId,
        @NotNull @Size(min = 1, max = 40) List<@NotNull @Valid TextMessage> messages,
        @Size(max = 0) Map<String, Object> state,
        @Size(max = 0) List<Object> tools,
        @Size(max = 0) List<Object> context,
        @Size(max = 0) Map<String, Object> forwardedProps,
        @Size(max = 0) List<Object> resume) {
    public record TextMessage(
            @NotBlank @Size(max = 64) String id,
            @NotNull @Pattern(regexp = "user|assistant") String role,
            @NotBlank @Size(max = 4000) String content) { }
}
