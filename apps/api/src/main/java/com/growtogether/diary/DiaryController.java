package com.growtogether.diary;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import com.growtogether.diary.domain.dto.DiaryRequest;
import com.growtogether.diary.domain.dto.DiaryResponse;
import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/diary")
@RequiredArgsConstructor
public class DiaryController {
    private final DiaryService diaryService;

    @PostMapping
    public ResponseEntity<DiaryResponse> createDiary(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody DiaryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(diaryService.create(Long.valueOf(jwt.getSubject()), request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<DiaryResponse> getDiary(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return ResponseEntity.ok(diaryService.getDiary(Long.valueOf(jwt.getSubject()), id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<DiaryResponse> updateDiary(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @Valid @RequestBody DiaryRequest request) {
        return ResponseEntity.ok(diaryService.updateDiary(Long.valueOf(jwt.getSubject()), id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDiary(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        diaryService.deleteDiary(Long.valueOf(jwt.getSubject()), id);
        return ResponseEntity.noContent().build();
    }
}
