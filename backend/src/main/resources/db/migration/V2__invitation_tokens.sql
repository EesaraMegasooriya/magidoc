-- Invitations get a secret link token and an expiry date (used by invite emails).
ALTER TABLE workspace_invitations ADD COLUMN token VARCHAR(64);
ALTER TABLE workspace_invitations ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;

UPDATE workspace_invitations
SET token      = REPLACE(CAST(id AS VARCHAR(36)), '-', ''),
    expires_at = updated_at + INTERVAL '7' DAY;

ALTER TABLE workspace_invitations ALTER COLUMN token SET NOT NULL;
ALTER TABLE workspace_invitations ALTER COLUMN expires_at SET NOT NULL;
CREATE UNIQUE INDEX uq_workspace_invitations_token ON workspace_invitations (token);
