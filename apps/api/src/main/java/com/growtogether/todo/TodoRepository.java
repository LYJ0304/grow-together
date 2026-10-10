package com.growtogether.todo;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository 
public interface TodoRepository extends JpaRepository<Todo, Long> {
    List<Todo> findByScheduledDateOrderByScheduledTimeAsc(LocalDate date);
}
