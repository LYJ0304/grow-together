package com.growtogether.user;

import java.util.Optional;
import org.springframework.data.repository.Repository;

// Profile mutations use a managed User in the service transaction, without depending on auth internals.
public interface UserProfileRepository extends Repository<User, Long> {
    Optional<User> findById(Long id);
}
