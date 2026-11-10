package com.growtogether.child;

import com.growtogether.child.dto.ChildProfileRequest;
import com.growtogether.child.dto.ChildProfileResponse;
import com.growtogether.child.dto.ChildPersonalization;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class ChildProfileService {
    private final ChildProfileRepository profiles;

    @Transactional
    public ChildProfileResponse create(Long userId, ChildProfileRequest request) {
        profiles.lockOwner(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        if (profiles.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Child profile already exists");
        }
        ChildProfile profile = new ChildProfile(userId, request.name(), request.birthday());
        applyPersonalization(profile, request.personalization());
        return ChildProfileResponse.from(profiles.saveAndFlush(profile));
    }

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
        var dueDate = request.personalization() == null ? profile.getExpectedDueDate()
                : request.personalization().expectedDueDate();
        if (dueDate != null && !dueDate.isAfter(request.birthday())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Birthday must precede the expected due date; update personalization explicitly");
        }
        profile.update(request.name(), request.birthday());
        applyPersonalization(profile, request.personalization());
        return ChildProfileResponse.from(profiles.saveAndFlush(profile));
    }
    private void applyPersonalization(ChildProfile profile, ChildPersonalization personalization) {
        if (personalization != null) {
            profile.replacePersonalization(personalization.prematurityStatus(), personalization.expectedDueDate(),
                    personalization.concerns(), personalization.availableActivityTime());
        }
    }
}
