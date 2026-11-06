package com.growtogether.child;

import com.growtogether.child.dto.ChildProfileRequest;
import com.growtogether.child.dto.ChildProfileResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/children/me")
@RequiredArgsConstructor
public class ChildProfileController {
    private final ChildProfileService profiles;

    @GetMapping
    public ChildProfileResponse get(@AuthenticationPrincipal Jwt jwt) {
        return profiles.get(Long.valueOf(jwt.getSubject()));
    }

    @PutMapping
    public ChildProfileResponse save(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ChildProfileRequest request) {
        return profiles.save(Long.valueOf(jwt.getSubject()), request);
    }
}
