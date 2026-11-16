package com.growtogether.user;

import com.growtogether.user.dto.UpdateUserProfileRequest;
import com.growtogether.user.dto.UserProfileResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserProfileService {
    private final UserProfileRepository users;

    public UserProfileResponse getProfile(Long userId) {
        return UserProfileResponse.from(findUser(userId));
    }

    @Transactional
    public UserProfileResponse updateProfile(Long userId, UpdateUserProfileRequest request) {
        User user = findUser(userId);
        user.rename(request.name().replaceAll("(?U)^[\\s\\uFEFF]+|[\\s\\uFEFF]+$", ""));
        return UserProfileResponse.from(user);
    }

    private User findUser(Long userId) {
        return users.findById(userId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }
}
