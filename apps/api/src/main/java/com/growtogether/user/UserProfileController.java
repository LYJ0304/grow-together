package com.growtogether.user;

import com.growtogether.user.dto.UpdateUserProfileRequest;
import com.growtogether.user.dto.UserProfileResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/users/me")
public class UserProfileController {
    private final UserProfileService profiles;

    @GetMapping
    public ResponseEntity<UserProfileResponse> getProfile(@AuthenticationPrincipal Jwt jwt) {
        return response(profiles.getProfile(Long.valueOf(jwt.getSubject())));
    }

    @PatchMapping
    public ResponseEntity<UserProfileResponse> updateProfile(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UpdateUserProfileRequest request) {
        return response(profiles.updateProfile(Long.valueOf(jwt.getSubject()), request));
    }

    private ResponseEntity<UserProfileResponse> response(UserProfileResponse profile) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(profile);
    }
}
