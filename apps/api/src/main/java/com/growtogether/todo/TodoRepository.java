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
    List<Todo> findByUserIdAndScheduledDateOrderByScheduledTimeAsc(Long userId, LocalDate date);

    Optional<Todo> findByIdAndUserId(Long id, Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Todo t where t.id = :id and t.userId = :userId")
    Optional<Todo> findForDiaryByIdAndUserId(Long id, Long userId);
}
