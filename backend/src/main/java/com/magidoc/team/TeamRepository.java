package com.magidoc.team;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

public interface TeamRepository extends JpaRepository<Team, UUID> {

    default Map<UUID, Team> mapByIds(Collection<UUID> ids) {
        return findAllById(ids).stream().collect(Collectors.toMap(Team::getId, Function.identity()));
    }
}
