package com.growtogether.child;

import static org.assertj.core.api.Assertions.assertThat;

import com.growtogether.auth.AuthRepository;
import com.growtogether.user.User;
import java.time.LocalDate;
import java.util.TimeZone;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.jdbc.core.JdbcTemplate;

@DataJpaTest
@ActiveProfiles("test")
class ChildProfileRepositoryTest {
    @Autowired private ChildProfileRepository profiles;
    @Autowired private AuthRepository users;
    @Autowired private TestEntityManager entityManager;
    @Autowired private JdbcTemplate jdbc;

    @ParameterizedTest
    @CsvSource({
            "Asia/Seoul, 0001-01-01",
            "UTC, 0001-01-01",
            "America/Los_Angeles, 0001-01-01",
            "Asia/Seoul, 1582-10-10",
            "Asia/Seoul, 2024-02-29"
    })
    void birthday_시간대와무관하게동일한날짜를저장하고조회(String zone, LocalDate birthday) {
        TimeZone original = TimeZone.getDefault();
        try {
            TimeZone.setDefault(TimeZone.getTimeZone(zone));
            Long ownerId = user("birthday@example.com");
            profiles.saveAndFlush(new ChildProfile(ownerId, "하늘", birthday));
            entityManager.clear();

            assertThat(jdbc.queryForObject("SELECT birthday FROM child_profile WHERE user_id = ?",
                    LocalDate.class, ownerId)).isEqualTo(birthday);
            assertThat(profiles.findById(ownerId).orElseThrow().getBirthday()).isEqualTo(birthday);
        } finally {
            TimeZone.setDefault(original);
        }
    }

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
