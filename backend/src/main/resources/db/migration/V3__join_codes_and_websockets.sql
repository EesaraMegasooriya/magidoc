-- Email invitations are replaced by simple workspace join codes.
DROP TABLE workspace_invitations;

ALTER TABLE workspaces ADD COLUMN join_code VARCHAR(16);
ALTER TABLE workspaces ADD COLUMN join_role VARCHAR(20) DEFAULT 'EDITOR' NOT NULL;
CREATE UNIQUE INDEX uq_workspaces_join_code ON workspaces (join_code);

-- Saved WebSocket connections (the socket itself runs in the user's browser).
CREATE TABLE websocket_requests (
    id           UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    name         VARCHAR(200) NOT NULL,
    url          VARCHAR(4000) NOT NULL,
    protocols    VARCHAR,
    messages     VARCHAR,
    created_by   UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_websocket_requests_workspace ON websocket_requests (workspace_id);
