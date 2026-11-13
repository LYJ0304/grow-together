package com.growtogether.todo.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.growtogether.todo.ChildReaction;
import tools.jackson.databind.JsonNode;

public record TodoReactionRequest(ChildReaction childReaction) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static TodoReactionRequest from(JsonNode input) {
        if (!input.isObject() || !input.has("childReaction")) {
            throw new IllegalArgumentException("childReaction is required; use null to clear it");
        }
        JsonNode value = input.get("childReaction");
        if (value.isNull()) return new TodoReactionRequest(null);
        if (!value.isString()) throw new IllegalArgumentException("childReaction must be a string or null");
        return new TodoReactionRequest(ChildReaction.valueOf(value.stringValue()));
    }
}
