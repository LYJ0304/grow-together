package com.growtogether.chat.dto;

import com.growtogether.chat.domain.ChatMessage;
import com.growtogether.chat.domain.Conversation;
import com.growtogether.chat.domain.MessageRole;
import com.growtogether.chat.domain.MessageStatus;
import java.time.Instant;

public record ChatResponse(Long id, Instant createdAt) {
    public static ChatResponse from(Conversation conversation) {
        return new ChatResponse(conversation.getId(), conversation.getCreatedAt());
    }

    public record Turn(Message userMessage, Message assistantMessage) { }

    public record Message(Long id, MessageRole role, String content, MessageStatus status, Instant createdAt) {
        public static Message from(ChatMessage message) {
            return new Message(message.getId(), message.getRole(), message.getContent(),
                    message.getStatus(), message.getCreatedAt());
        }
    }
}
