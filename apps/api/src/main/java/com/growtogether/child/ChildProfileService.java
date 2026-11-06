package com.growtogether.child;

import com.growtogether.child.dto.ChildProfileRequest;
import com.growtogether.child.dto.ChildProfileResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class ChildProfileService {
    private final ChildProfileRepository profiles;

    @Transactional(readOnly = true)
    public ChildProfileResponse get(Long userId) {
        return profiles.findById(userId).map(ChildProfileResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Child profile not found"));
    }

    @Transactional
    public ChildProfileResponse save(Long userId, ChildProfileRequest request) {
        profiles.lockOwner(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        ChildProfile profile = profiles.findById(userId)
                .orElseGet(() -> new ChildProfile(userId, request.name(), request.birthday()));
        profile.update(request.name(), request.birthday());
        return ChildProfileResponse.from(profiles.saveAndFlush(profile));
    }
}
