package com.growtogether.chat.service;

import com.growtogether.chat.domain.Conversation;
import com.growtogether.chat.domain.ChatMessage;
import com.growtogether.chat.domain.MessageRole;
import com.growtogether.chat.domain.MessageStatus;
import com.growtogether.chat.client.AiWorkerClient;
import com.growtogether.chat.dto.ChatResponse;
import com.growtogether.chat.repository.ChatMessageRepository;
import com.growtogether.chat.repository.ConversationRepository;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChatService {
    private final ConversationRepository conversations;
    private final ChatMessageRepository messages;

    @Transactional
    public ChatResponse create(Long userId) {
        return ChatResponse.from(conversations.saveAndFlush(new Conversation(userId)));
    }

    public List<ChatResponse> list(Long userId) {
        return conversations.findByUserIdOrderByIdDesc(userId).stream().map(ChatResponse::from).toList();
    }

    public List<ChatResponse.Message> messages(Long userId, Long id) {
        findConversation(userId, id);
        return messages.findByConversationIdOrderByIdAsc(id).stream().map(ChatResponse.Message::from).toList();
    }

    @Transactional
    public void delete(Long userId, Long id) {
        Conversation conversation = lockConversation(userId, id);
        requireIdle(id);
        messages.deleteByConversationId(id);
        conversations.delete(conversation);
    }

    public record PendingTurn(ChatResponse.Message userMessage, Long assistantId, List<AiWorkerClient.Message> history) { }

    @Transactional
    public PendingTurn beginTurn(Long userId, Long id, String content) {
        Conversation conversation = lockConversation(userId, id);
        requireIdle(id);
        ChatMessage userMessage = messages.saveAndFlush(
                new ChatMessage(conversation, MessageRole.USER, content, MessageStatus.COMPLETED));
        List<AiWorkerClient.Message> history = messages.findByConversationIdOrderByIdAsc(id).stream()
                .filter(message -> message.getStatus() == MessageStatus.COMPLETED)
                .map(message -> new AiWorkerClient.Message(message.getRole().name().toLowerCase(Locale.ROOT), message.getContent()))
                .toList();
        ChatMessage assistant = messages.saveAndFlush(
                new ChatMessage(conversation, MessageRole.ASSISTANT, "", MessageStatus.STREAMING));
        return new PendingTurn(ChatResponse.Message.from(userMessage), assistant.getId(), history);
    }

    @Transactional
    public ChatResponse.Message complete(Long assistantId, String content) {
        ChatMessage assistant = messages.findForUpdate(assistantId).orElseThrow();
        if (assistant.getStatus() == MessageStatus.STREAMING) {
            assistant.complete(content);
        }
        return ChatResponse.Message.from(assistant);
    }

    @Transactional
    public void fail(Long assistantId, String partialContent) {
        messages.findForUpdate(assistantId).ifPresent(assistant -> {
            if (assistant.getStatus() == MessageStatus.STREAMING) {
                assistant.fail(partialContent);
            }
        });
    }

    private Conversation lockConversation(Long userId, Long id) {
        return conversations.findForUpdate(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));
    }

    private void requireIdle(Long id) {
        // shortcut: a process crash leaves STREAMING replies; add recovery when durable retries are required.
        if (messages.existsByConversationIdAndStatus(id, MessageStatus.STREAMING)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An assistant reply is already in progress");
        }
    }

    private Conversation findConversation(Long userId, Long id) {
        return conversations.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));
    }
}
