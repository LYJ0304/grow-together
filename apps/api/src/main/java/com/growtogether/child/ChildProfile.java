package com.growtogether.child;

import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import java.util.List;
import java.util.ArrayList;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

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
    // Keep calendar dates out of java.sql.Date's timezone and historical calendar conversions.
    @JdbcTypeCode(SqlTypes.LOCAL_DATE)
    private LocalDate birthday;

    @Column(name = "prematurity_status", length = 7)
    private String prematurityStatus;

    @Column(name = "expected_due_date")
    @JdbcTypeCode(SqlTypes.LOCAL_DATE)
    private LocalDate expectedDueDate;

    @Column(name = "available_activity_time", length = 10)
    private String availableActivityTime;

    @ElementCollection
    @CollectionTable(name = "child_profile_concern", joinColumns = @JoinColumn(name = "user_id"))
    @OrderColumn(name = "position")
    @Column(name = "concern", nullable = false, length = 24)
    private List<String> concerns = new ArrayList<>();

    public ChildProfile(Long userId, String name, LocalDate birthday) {
        this.userId = userId;
        update(name, birthday);
    }

    public void update(String name, LocalDate birthday) {
        this.name = name;
        this.birthday = birthday;
    }
    public void replacePersonalization(String status, LocalDate dueDate, List<String> selectedConcerns,
            String activityTime) {
        prematurityStatus = status;
        expectedDueDate = dueDate;
        concerns.clear();
        concerns.addAll(selectedConcerns);
        availableActivityTime = activityTime;
    }
}
