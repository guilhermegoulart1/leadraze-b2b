-- Migration 123: Create Quick Replies table
-- Users can save pre-defined responses for quick use in conversations

CREATE TABLE IF NOT EXISTS quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    shortcut VARCHAR(50),
    is_global BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_quick_replies_account_user ON quick_replies(account_id, user_id);
CREATE INDEX IF NOT EXISTS idx_quick_replies_global ON quick_replies(account_id, is_global) WHERE is_global = true;

-- Comments
COMMENT ON TABLE quick_replies IS 'Pre-defined text responses for quick use in conversations';
COMMENT ON COLUMN quick_replies.title IS 'Short title/description for the quick reply';
COMMENT ON COLUMN quick_replies.content IS 'The actual text content to insert';
COMMENT ON COLUMN quick_replies.shortcut IS 'Optional keyboard shortcut identifier';
COMMENT ON COLUMN quick_replies.is_global IS 'If true, visible to all users in the account';
COMMENT ON COLUMN quick_replies.is_active IS 'Whether the quick reply is active/visible';
