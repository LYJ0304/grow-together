package com.growtogether.chat.repository;

import com.growtogether.chat.domain.Conversation;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    List<Conversation> findByUserIdOrderByIdDesc(Long userId);
    Optional<Conversation> findByIdAndUserId(Long id, Long userId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Conversation c where c.id = :id and c.userId = :userId")
    Optional<Conversation> findForUpdate(Long id, Long userId);
}
