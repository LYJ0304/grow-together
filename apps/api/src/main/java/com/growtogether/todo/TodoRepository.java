package com.growtogether.todo;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;
import java.util.Optional;

@Repository 
public interface TodoRepository extends JpaRepository<Todo, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :userId")
    Optional<com.growtogether.user.User> lockOwner(Long userId);

    List<Todo> findByUserIdAndScheduledDateOrderByScheduledTimeAsc(Long userId, LocalDate date);

    List<Todo> findByUserIdAndScheduledDateGreaterThanEqualAndScheduledDateLessThanOrderByScheduledDateAscScheduledTimeAscIdAsc(
            Long userId, LocalDate start, LocalDate end);

    Optional<Todo> findByIdAndUserId(Long id, Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Todo t where t.id = :id and t.userId = :userId")
    Optional<Todo> findForDiaryByIdAndUserId(Long id, Long userId);
}
