-- Text space: notes and code snippets shared inside a workspace.
CREATE TABLE snippets (
    id           UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    title        VARCHAR(200) NOT NULL,
    kind         VARCHAR(10) NOT NULL,
    language     VARCHAR(30),
    content      VARCHAR NOT NULL DEFAULT '',
    pinned       BOOLEAN NOT NULL DEFAULT FALSE,
    created_by   UUID REFERENCES users (id) ON DELETE SET NULL,
    updated_by   UUID REFERENCES users (id) ON DELETE SET NULL,
    version      BIGINT NOT NULL DEFAULT 0,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_snippets_workspace ON snippets (workspace_id, updated_at);
