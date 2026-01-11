-- Migration: Create invitation_snapshots table
-- Purpose: Track LinkedIn invitations for notification detection
-- - Sent invitations: detect when accepted (via MessageReceived webhook for messages, NewRelation for others)
-- - Received invitations: detect new ones via polling (every 4h)

-- Create table
CREATE TABLE IF NOT EXISTS invitation_snapshots (
    id SERIAL PRIMARY KEY,
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    linkedin_account_id UUID REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
    invitation_type VARCHAR(20) NOT NULL CHECK (invitation_type IN ('sent', 'received')),
    invitation_id VARCHAR(255) NOT NULL,
    provider_id VARCHAR(255), -- LinkedIn user ID (for matching on accept)
    public_identifier VARCHAR(255), -- LinkedIn public profile ID
    user_name VARCHAR(255),
    user_headline TEXT,
    user_profile_picture TEXT,
    invitation_message TEXT, -- Message sent with invitation (if any)
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint to avoid duplicates
    UNIQUE(linkedin_account_id, invitation_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_invitation_snapshots_linkedin_account
    ON invitation_snapshots(linkedin_account_id);

CREATE INDEX IF NOT EXISTS idx_invitation_snapshots_type
    ON invitation_snapshots(linkedin_account_id, invitation_type);

CREATE INDEX IF NOT EXISTS idx_invitation_snapshots_provider_id
    ON invitation_snapshots(linkedin_account_id, provider_id);

-- Comment
COMMENT ON TABLE invitation_snapshots IS 'Tracks LinkedIn invitations for notification detection. Sent invitations are matched when accepted. Received invitations are detected via polling.';
