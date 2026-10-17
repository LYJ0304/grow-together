package com.growtogether.diary.domain;

import com.growtogether.todo.Todo;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.ArrayList;

@Entity
@Table(name = "diary")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Diary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Size(max = 1000)
    @Column(length = 1000)
    private String content;

    @OneToMany(mappedBy = "diary")
    private List<Todo> todos = new ArrayList<>();

    @OneToMany(
        mappedBy = "diary",
        cascade = CascadeType.ALL,
        orphanRemoval = true
    )
    private List<DiaryFile> diaryFiles = new ArrayList<>();

    public Diary(Long userId, String content) {
        this.userId = userId;
        this.content = content;
    }

    public void updateContent(String content) {
        this.content = content;
    }

    public void replaceTodos(List<Todo> replacements) {
        todos.forEach(todo -> todo.setDiary(null));
        todos.clear();
        replacements.forEach(todo -> {
            todos.add(todo);
            todo.setDiary(this);
        });
    }

    public void addDiaryFile(DiaryFile diaryFile) {
        diaryFiles.add(diaryFile);
        diaryFile.setDiary(this);
    }
}
