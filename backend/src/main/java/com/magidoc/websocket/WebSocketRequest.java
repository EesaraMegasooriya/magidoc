package com.magidoc.websocket;

import com.magidoc.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

/** A saved WebSocket connection. The socket itself is opened by the user's browser. */
@Entity
@Table(name = "websocket_requests")
@Getter
@Setter
public class WebSocketRequest extends BaseEntity {

    @Column(name = "workspace_id", nullable = false)
    private UUID workspaceId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String url;

    /** JSON array of subprotocol strings. */
    private String protocols;

    /** JSON array of saved message templates: {id, name, body, format}. */
    private String messages;

    @Column(name = "created_by")
    private UUID createdBy;
}
