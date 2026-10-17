package com.growtogether.diary;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.growtogether.diary.domain.Diary;
import java.util.Optional;

@Repository
public interface DiaryRepository extends JpaRepository<Diary, Long> {
    Optional<Diary> findByIdAndUserId(Long id, Long userId);
}
