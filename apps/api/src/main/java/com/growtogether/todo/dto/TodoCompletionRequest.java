package com.growtogether.todo.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import tools.jackson.databind.JsonNode;

public record TodoCompletionRequest(boolean completed) {
    // Reject coercion of strings/numbers so this operation accepts JSON booleans only.
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static TodoCompletionRequest from(JsonNode input) {
        JsonNode completed = input.path("completed");
        if (!completed.isBoolean()) {
            throw new IllegalArgumentException("completed must be a boolean");
        }
        return new TodoCompletionRequest(completed.booleanValue());
    }
}
