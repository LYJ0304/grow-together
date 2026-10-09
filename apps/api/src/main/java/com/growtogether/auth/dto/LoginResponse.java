package com.growtogether.auth.dto;

public record LoginResponse(
    String accessToken,
    String refreshToken,
    String tokenType,
    long expiresIn
) {
    @Override public String toString() { return "LoginResponse[redacted]"; }
}
