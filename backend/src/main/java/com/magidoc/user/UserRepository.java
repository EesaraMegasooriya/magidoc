package com.magidoc.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    default Map<UUID, User> mapByIds(Collection<UUID> ids) {
        return findAllById(ids).stream().collect(Collectors.toMap(User::getId, Function.identity()));
    }
}
