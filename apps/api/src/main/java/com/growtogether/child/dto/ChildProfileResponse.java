package com.growtogether.child.dto;

import com.growtogether.child.ChildProfile;
import java.time.LocalDate;

public record ChildProfileResponse(String name, LocalDate birthday) {
    public static ChildProfileResponse from(ChildProfile profile) {
        return new ChildProfileResponse(profile.getName(), profile.getBirthday());
    }
}
