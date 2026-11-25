package com.magidoc.websocket;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WebSocketRequestRepository extends JpaRepository<WebSocketRequest, UUID> {

    List<WebSocketRequest> findByWorkspaceIdOrderByNameAsc(UUID workspaceId);
}
