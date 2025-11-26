-- Migration: Create lead comments table with mentions support
-- Purpose: Allow team collaboration with comments on leads and mention other users

-- Create lead_comments table
CREATE TABLE IF NOT EXISTS lead_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,

  -- Comment content
  content TEXT NOT NULL,

  -- Mentions (array of user IDs mentioned in the comment)
  mentions UUID[] DEFAULT '{}',

  -- Attachments (optional, for future use)
  attachments JSONB,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Create lead_comment_mentions table for tracking individual mentions
CREATE TABLE IF NOT EXISTS lead_comment_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES lead_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Read status
  read_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_lead_comments_lead_id ON lead_comments(lead_id);
CREATE INDEX idx_lead_comments_user_id ON lead_comments(user_id);
CREATE INDEX idx_lead_comments_account_id ON lead_comments(account_id);
CREATE INDEX idx_lead_comments_created_at ON lead_comments(created_at DESC);
CREATE INDEX idx_lead_comments_mentions ON lead_comments USING GIN(mentions);

CREATE INDEX idx_lead_comment_mentions_comment_id ON lead_comment_mentions(comment_id);
CREATE INDEX idx_lead_comment_mentions_user_id ON lead_comment_mentions(user_id);
CREATE INDEX idx_lead_comment_mentions_read ON lead_comment_mentions(user_id, read_at) WHERE read_at IS NULL;

-- Comments
COMMENT ON TABLE lead_comments IS 'Comments on leads with support for mentions and collaboration';
COMMENT ON COLUMN lead_comments.mentions IS 'Array of user IDs mentioned in this comment using @';
COMMENT ON TABLE lead_comment_mentions IS 'Individual mention records for notifications';
