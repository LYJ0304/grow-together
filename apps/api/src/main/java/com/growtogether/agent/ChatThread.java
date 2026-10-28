package com.growtogether.agent;

import java.util.UUID;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "chat_thread")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatThread {
    @Id private UUID id;
    @Column(nullable = false) private Long userId;

    public ChatThread(Long userId) {
        this.id = UUID.randomUUID();
        this.userId = userId;
    }
}
