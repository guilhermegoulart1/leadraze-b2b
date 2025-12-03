-- Migration: 056_create_task_comments.sql
-- Description: Create task comments table with mentions support (for checklist_items)

-- Create task_comments table (comments on checklist items/tasks)
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,

  -- Comment content
  content TEXT NOT NULL,

  -- Mentions (array of user IDs mentioned in the comment)
  mentions UUID[] DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Create task_comment_mentions table for tracking individual mentions
CREATE TABLE IF NOT EXISTS task_comment_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Read status
  read_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_account_id ON task_comments(account_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON task_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_comments_mentions ON task_comments USING GIN(mentions);

CREATE INDEX IF NOT EXISTS idx_task_comment_mentions_comment_id ON task_comment_mentions(comment_id);
CREATE INDEX IF NOT EXISTS idx_task_comment_mentions_user_id ON task_comment_mentions(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comment_mentions_read ON task_comment_mentions(user_id, read_at) WHERE read_at IS NULL;

-- Comments
COMMENT ON TABLE task_comments IS 'Comments on tasks/checklist items with support for mentions';
COMMENT ON COLUMN task_comments.task_id IS 'References checklist_items.id (tasks are stored in checklist_items table)';
COMMENT ON COLUMN task_comments.mentions IS 'Array of user IDs mentioned in this comment using @';
