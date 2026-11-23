package com.growtogether.child.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.growtogether.child.ChildProfile;
import java.time.LocalDate;

public record ChildProfileResponse(
        String name,
        LocalDate birthday,
        @JsonInclude(JsonInclude.Include.NON_NULL) String gender,
        ChildPersonalization personalization
) {
    public ChildProfileResponse(String name, LocalDate birthday) {
        this(name, birthday, null, ChildPersonalization.empty());
    }
    public static ChildProfileResponse from(ChildProfile profile) {
        return new ChildProfileResponse(profile.getName(), profile.getBirthday(), profile.getGender(),
                new ChildPersonalization(profile.getPrematurityStatus(), profile.getExpectedDueDate(),
                        profile.getConcerns(), profile.getAvailableActivityTime(), java.util.List.of()));
    }
}
