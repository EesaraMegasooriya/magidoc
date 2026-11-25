package com.magidoc.environment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EnvironmentRepository extends JpaRepository<Environment, UUID> {

    List<Environment> findByWorkspaceIdOrderByGlobalDescNameAsc(UUID workspaceId);
}
