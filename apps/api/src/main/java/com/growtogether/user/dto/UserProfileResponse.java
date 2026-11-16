package com.growtogether.user.dto;

import com.growtogether.user.User;

public record UserProfileResponse(Long id, String name, String email) {
    public static UserProfileResponse from(User user) {
        return new UserProfileResponse(user.getId(), user.getName(), user.getEmail());
    }
}
