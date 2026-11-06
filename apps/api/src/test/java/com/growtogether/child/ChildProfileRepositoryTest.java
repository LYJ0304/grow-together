package com.growtogether.child;

import static org.assertj.core.api.Assertions.assertThat;

import com.growtogether.auth.AuthRepository;
import com.growtogether.user.User;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
class ChildProfileRepositoryTest {
    @Autowired private ChildProfileRepository profiles;
    @Autowired private AuthRepository users;
    @Autowired private TestEntityManager entityManager;

    @Test
    void save_저장후계정별로조회() {
        Long ownerId = user("owner@example.com");
        Long otherId = user("other@example.com");
        LocalDate birthday = LocalDate.of(2024, 3, 15);
        profiles.saveAndFlush(new ChildProfile(ownerId, "하늘", birthday));
        entityManager.clear();

        var found = profiles.findById(ownerId).orElseThrow();
        assertThat(found.getUserId()).isEqualTo(ownerId);
        assertThat(found.getName()).isEqualTo("하늘");
        assertThat(found.getBirthday()).isEqualTo(birthday);
        assertThat(profiles.findById(otherId)).isEmpty();
    }

    @Test
    void update_수정값을저장후조회() {
        Long ownerId = user("owner@example.com");
        profiles.saveAndFlush(new ChildProfile(ownerId, "하늘", LocalDate.of(2024, 3, 15)));
        entityManager.clear();
        var profile = profiles.findById(ownerId).orElseThrow();
        profile.update("바다", LocalDate.of(2023, 2, 28));
        profiles.flush();
        entityManager.clear();

        var found = profiles.findById(ownerId).orElseThrow();
        assertThat(found.getName()).isEqualTo("바다");
        assertThat(found.getBirthday()).isEqualTo(LocalDate.of(2023, 2, 28));
        assertThat(profiles.count()).isEqualTo(1);
    }

    @Test
    void lockOwner_존재하는계정만반환() {
        Long ownerId = user("owner@example.com");
        entityManager.clear();

        assertThat(profiles.lockOwner(ownerId)).isPresent();
        assertThat(profiles.lockOwner(Long.MAX_VALUE)).isEmpty();
    }

    private Long user(String email) {
        return users.saveAndFlush(new User("Owner", email, "unused-test-hash")).getId();
    }
}
