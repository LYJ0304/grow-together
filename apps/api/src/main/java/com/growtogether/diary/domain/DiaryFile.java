package com.growtogether.diary.domain;


import java.util.UUID;
import jakarta.persistence.Entity;
import jakarta.persistence.Column;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "diary_file")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DiaryFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "image_url", length = 2048)
    private String imageUrl;

    @Column(name = "stored_file_id")
    private UUID storedFileId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "diary_id", nullable = false)
    private Diary diary;

    public DiaryFile(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public DiaryFile(UUID storedFileId) {
        this.storedFileId = storedFileId;
    }

    public void setDiary(Diary diary) {
        this.diary = diary;
    }

}
