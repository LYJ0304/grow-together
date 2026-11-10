package com.growtogether.child.dto;

import com.growtogether.child.ChildProfile;
import java.time.LocalDate;

public record ChildProfileResponse(String name, LocalDate birthday, ChildPersonalization personalization) {
    public ChildProfileResponse(String name, LocalDate birthday) {
        this(name, birthday, ChildPersonalization.empty());
    }
    public static ChildProfileResponse from(ChildProfile profile) {
        return new ChildProfileResponse(profile.getName(), profile.getBirthday(),
                new ChildPersonalization(profile.getPrematurityStatus(), profile.getExpectedDueDate(),
                        profile.getConcerns(), profile.getAvailableActivityTime(), java.util.List.of()));
    }
}
