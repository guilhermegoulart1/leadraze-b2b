-- Migration: 013_add_feedback_system.sql
-- Created: 2025-12-01
-- Description: Sistema de Feedback & Roadmap (GetRaze Next)

-- =============================================
-- FEEDBACK TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'suggestion', -- suggestion, backlog, in_progress, done
  vote_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for listing by status (most common query)
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);

-- Index for sorting by votes
CREATE INDEX IF NOT EXISTS idx_feedback_votes ON feedback(vote_count DESC);

-- Index for sorting by date
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);

-- =============================================
-- FEEDBACK VOTES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS feedback_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(feedback_id, user_id) -- One vote per user per feedback
);

-- Index for checking if user voted
CREATE INDEX IF NOT EXISTS idx_feedback_votes_user ON feedback_votes(user_id, feedback_id);

-- =============================================
-- FEEDBACK COMMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS feedback_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_admin_reply BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for listing comments by feedback
CREATE INDEX IF NOT EXISTS idx_feedback_comments_feedback ON feedback_comments(feedback_id, created_at);

-- =============================================
-- TRIGGER: Update comment_count on feedback
-- =============================================
CREATE OR REPLACE FUNCTION update_feedback_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feedback SET comment_count = comment_count + 1 WHERE id = NEW.feedback_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feedback SET comment_count = comment_count - 1 WHERE id = OLD.feedback_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_feedback_comment_count ON feedback_comments;
CREATE TRIGGER trigger_feedback_comment_count
AFTER INSERT OR DELETE ON feedback_comments
FOR EACH ROW EXECUTE FUNCTION update_feedback_comment_count();
