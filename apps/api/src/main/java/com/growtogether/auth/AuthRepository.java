package com.growtogether.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import com.growtogether.user.User;
import java.util.Optional;

public interface AuthRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
}
