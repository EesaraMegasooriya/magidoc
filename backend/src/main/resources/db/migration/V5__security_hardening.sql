-- Server-side session revocation: tokens carry the user's token version; bumping it invalidates them all.
ALTER TABLE users ADD COLUMN token_version INT DEFAULT 0 NOT NULL;

-- One-time recovery codes (stored as BCrypt hashes) for resetting a forgotten password without email.
CREATE TABLE recovery_codes (
    id         UUID PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code_hash  VARCHAR(100) NOT NULL,
    used_at    TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_recovery_codes_user ON recovery_codes (user_id);
