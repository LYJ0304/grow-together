package com.growtogether.child;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.inOrder;

import com.growtogether.child.dto.ChildProfileRequest;
import java.util.List;
import com.growtogether.user.User;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ChildProfileServiceTest {
    private final Long userId = 1L;
    private final LocalDate birthday = LocalDate.of(2024, 3, 15);
    @Mock private ChildProfileRepository profiles;
    @InjectMocks private ChildProfileService service;

    @Test
    void create_계정잠금후중복을확인하고본인소유로등록() {
        given(profiles.lockOwner(userId)).willReturn(Optional.of(new User("Owner", "owner@example.com", "hash")));
        given(profiles.existsById(userId)).willReturn(false);
        given(profiles.saveAndFlush(any(ChildProfile.class))).willAnswer(invocation -> invocation.getArgument(0));

        var response = service.create(userId, new ChildProfileRequest("하늘", birthday));

        var saved = ArgumentCaptor.forClass(ChildProfile.class);
        var order = inOrder(profiles);
        order.verify(profiles).lockOwner(userId);
        order.verify(profiles).existsById(userId);
        order.verify(profiles).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getUserId()).isEqualTo(userId);
        assertThat(response.name()).isEqualTo("하늘");
        assertThat(response.birthday()).isEqualTo(birthday);
    }

    @Test
    void create_이미등록되어있으면저장하지않고409반환() {
        given(profiles.lockOwner(userId)).willReturn(Optional.of(new User("Owner", "owner@example.com", "hash")));
        given(profiles.existsById(userId)).willReturn(true);

        assertThatThrownBy(() -> service.create(userId, new ChildProfileRequest("바다", birthday)))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        exception -> assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));

        then(profiles).should(never()).saveAndFlush(any());
    }

    @Test
    void create_계정이없으면저장하지않고404반환() {
        given(profiles.lockOwner(userId)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(userId, new ChildProfileRequest("하늘", birthday)))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        exception -> assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));

        then(profiles).should(never()).existsById(any());
        then(profiles).should(never()).saveAndFlush(any());
    }

    @Test
    void get_본인프로필을조회() {
        given(profiles.findById(userId)).willReturn(Optional.of(new ChildProfile(userId, "하늘", birthday)));

        var response = service.get(userId);

        assertThat(response.name()).isEqualTo("하늘");
        assertThat(response.birthday()).isEqualTo(birthday);
    }

    @Test
    void get_프로필이없으면404반환() {
        given(profiles.findById(userId)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(userId)).isInstanceOfSatisfying(ResponseStatusException.class,
                exception -> assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void save_프로필이없으면본인소유로등록() {
        given(profiles.lockOwner(userId)).willReturn(Optional.of(new User("Owner", "owner@example.com", "hash")));
        given(profiles.findById(userId)).willReturn(Optional.empty());
        given(profiles.saveAndFlush(any(ChildProfile.class))).willAnswer(invocation -> invocation.getArgument(0));

        var response = service.save(userId, new ChildProfileRequest("하늘", birthday));

        var saved = ArgumentCaptor.forClass(ChildProfile.class);
        then(profiles).should().saveAndFlush(saved.capture());
        assertThat(saved.getValue().getUserId()).isEqualTo(userId);
        assertThat(response.name()).isEqualTo("하늘");
        assertThat(response.birthday()).isEqualTo(birthday);
    }

    @Test
    void save_기존프로필을수정() {
        var profile = new ChildProfile(userId, "하늘", birthday);
        var request = new ChildProfileRequest("바다", birthday.minusYears(1));
        given(profiles.lockOwner(userId)).willReturn(Optional.of(new User("Owner", "owner@example.com", "hash")));
        given(profiles.findById(userId)).willReturn(Optional.of(profile));
        given(profiles.saveAndFlush(profile)).willReturn(profile);

        var response = service.save(userId, request);

        assertThat(profile.getUserId()).isEqualTo(userId);
        assertThat(profile.getName()).isEqualTo(request.name());
        assertThat(profile.getBirthday()).isEqualTo(request.birthday());
        assertThat(response.name()).isEqualTo(request.name());
        then(profiles).should().saveAndFlush(profile);
    }

    @Test
    void save_계정이없으면저장하지않고404반환() {
        given(profiles.lockOwner(userId)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.save(userId, new ChildProfileRequest("하늘", birthday)))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        exception -> assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));

        then(profiles).should(never()).findById(any());
        then(profiles).should(never()).saveAndFlush(any());
    }
    @Test
    void save_basicEditPreservesStoredPersonalization() {
        var profile = new ChildProfile(userId, "Before", birthday);
        profile.replacePersonalization("yes", birthday.plusMonths(1), List.of("sleep"), "10min");
        given(profiles.lockOwner(userId)).willReturn(Optional.of(new User("Owner", "owner@example.com", "hash")));
        given(profiles.findById(userId)).willReturn(Optional.of(profile));
        given(profiles.saveAndFlush(profile)).willReturn(profile);

        var result = service.save(userId, new ChildProfileRequest("After", birthday));

        assertThat(result.personalization().concerns()).containsExactly("sleep");
        assertThat(result.personalization().expectedDueDate()).isEqualTo(birthday.plusMonths(1));
        assertThat(result.personalization().availableActivityTime()).isEqualTo("10min");
    }

    @Test
    void save_invalidCombinedDateDoesNotMutateProfile() {
        var profile = new ChildProfile(userId, "Before", birthday);
        profile.replacePersonalization("yes", birthday.plusMonths(1), List.of("sleep"), "10min");
        given(profiles.lockOwner(userId)).willReturn(Optional.of(new User("Owner", "owner@example.com", "hash")));
        given(profiles.findById(userId)).willReturn(Optional.of(profile));

        assertThatThrownBy(() -> service.save(userId, new ChildProfileRequest("After", birthday.plusMonths(2))))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        assertThat(profile.getName()).isEqualTo("Before");
        assertThat(profile.getBirthday()).isEqualTo(birthday);
        assertThat(profile.getConcerns()).containsExactly("sleep");
        then(profiles).should(never()).saveAndFlush(any());
    }
}
