package com.growtogether.agent;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatThreadRepository extends JpaRepository<ChatThread, UUID> {
    boolean existsByIdAndUserId(UUID id, Long userId);
}
