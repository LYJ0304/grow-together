package com.growtogether.user;

import com.growtogether.user.dto.WithdrawalRequest;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
public class AccountWithdrawalController {
    private final AccountWithdrawalService accounts;
    public AccountWithdrawalController(AccountWithdrawalService accounts) { this.accounts = accounts; }

    @PostMapping("/api/v1/users/me/withdrawal")
    public ResponseEntity<Void> withdraw(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody WithdrawalRequest request) {
        accounts.withdraw(Long.valueOf(jwt.getSubject()), request.password());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
}
