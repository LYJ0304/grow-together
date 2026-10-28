package com.growtogether.chat.repository;

import com.growtogether.chat.domain.ChatMessage;
import com.growtogether.chat.domain.MessageStatus;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByConversationIdOrderByIdAsc(Long conversationId);
    void deleteByConversationId(Long conversationId);
    boolean existsByConversationIdAndStatus(Long conversationId, MessageStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from ChatMessage m where m.id = :id")
    Optional<ChatMessage> findForUpdate(Long id);
}
