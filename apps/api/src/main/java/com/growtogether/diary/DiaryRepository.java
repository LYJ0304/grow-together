package com.growtogether.diary;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.growtogether.diary.domain.Diary;
import java.util.Optional;
import java.util.List;
import java.time.LocalDate;

@Repository
public interface DiaryRepository extends JpaRepository<Diary, Long> {
    Optional<Diary> findByUserIdAndDiaryDate(Long userId, LocalDate date);
    List<Diary> findByUserIdAndDiaryDateGreaterThanEqualAndDiaryDateLessThanOrderByDiaryDateAsc(
            Long userId, LocalDate start, LocalDate end);
    Optional<Diary> findByIdAndUserId(Long id, Long userId);
}
