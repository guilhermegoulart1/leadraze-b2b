-- Migration 016: Add User Assignment to Conversations
-- Description: Allows conversations to be assigned to specific users within a sector

BEGIN;

-- ============================================
-- 1. ADD ASSIGNED_USER_ID TO CONVERSATIONS
-- ============================================

-- Add column to store which user is assigned to this conversation
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_user ON conversations(assigned_user_id);

-- Create composite index for filtering by sector and assignment status
CREATE INDEX IF NOT EXISTS idx_conversations_sector_assigned ON conversations(sector_id, assigned_user_id);

-- ============================================
-- 2. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN conversations.assigned_user_id IS 'User assigned to handle this conversation (NULL = unassigned)';

COMMIT;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 016 completed successfully!';
  RAISE NOTICE '📋 Changes:';
  RAISE NOTICE '   - Added assigned_user_id to conversations table';
  RAISE NOTICE '   - Created indexes for performance';
  RAISE NOTICE '   - Conversations can now be assigned to specific users';
  RAISE NOTICE '';
END $$;
