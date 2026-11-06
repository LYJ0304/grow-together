package com.growtogether.child;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "child_profile")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChildProfile {
    @Id
    @Column(name = "user_id", updatable = false)
    private Long userId;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false)
    private LocalDate birthday;

    public ChildProfile(Long userId, String name, LocalDate birthday) {
        this.userId = userId;
        update(name, birthday);
    }

    public void update(String name, LocalDate birthday) {
        this.name = name;
        this.birthday = birthday;
    }
}
