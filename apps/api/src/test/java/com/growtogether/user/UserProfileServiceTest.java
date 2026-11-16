package com.growtogether.user;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.BDDMockito.*;

import com.growtogether.user.dto.UpdateUserProfileRequest;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class UserProfileServiceTest {
    @Mock UserProfileRepository users;
    @InjectMocks UserProfileService profiles;

    @Test void missingUserCannotBeReadOrModified() {
        given(users.findById(99L)).willReturn(Optional.empty());
        assertThatThrownBy(() -> profiles.getProfile(99L)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> profiles.updateProfile(99L, new UpdateUserProfileRequest("이름")))
                .isInstanceOf(ResponseStatusException.class);
        then(users).should(times(2)).findById(99L);
        then(users).shouldHaveNoMoreInteractions();
    }

    @Test void trimsNameAndPreservesEmailAndPassword() {
        User user = new User("원래 이름", "original@example.com", "hash");
        given(users.findById(1L)).willReturn(Optional.of(user));
        var response = profiles.updateProfile(1L, new UpdateUserProfileRequest("  새 이름  "));
        assertThat(response.name()).isEqualTo("새 이름");
        assertThat(user.getEmail()).isEqualTo("original@example.com");
        assertThat(user.getPasswordHash()).isEqualTo("hash");
    }
}
