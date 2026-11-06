package com.growtogether.child;

import com.growtogether.user.User;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface ChildProfileRepository extends JpaRepository<ChildProfile, Long> {
    // Lock the existing owner so concurrent first saves cannot create duplicate profiles.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :userId")
    Optional<User> lockOwner(Long userId);
}
