-- Migration: Add AI Qualification fields to conversations
-- Adds fields for AI-powered lead qualification tracking

-- Add qualification fields to conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS qualification_score INTEGER DEFAULT NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS qualification_stage VARCHAR(20) DEFAULT NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS qualification_reasons JSONB DEFAULT NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS objections_history JSONB DEFAULT NULL;

-- Add index for filtering by qualification
CREATE INDEX IF NOT EXISTS idx_conversations_qualification_score ON conversations(qualification_score) WHERE qualification_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_qualification_stage ON conversations(qualification_stage) WHERE qualification_stage IS NOT NULL;

-- Add comment explaining the fields
COMMENT ON COLUMN conversations.qualification_score IS 'AI-generated lead qualification score (0-100)';
COMMENT ON COLUMN conversations.qualification_stage IS 'Qualification stage: cold, warm, MQL, SQL, hot';
COMMENT ON COLUMN conversations.qualification_reasons IS 'JSON array of reasons for the qualification score';
COMMENT ON COLUMN conversations.objections_history IS 'JSON array of objections detected during conversation';

-- Optional: Create dedicated table for objections (for detailed tracking)
CREATE TABLE IF NOT EXISTS conversation_objections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  text TEXT,
  severity VARCHAR(20) DEFAULT 'medium',
  detected_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_objection_type CHECK (type IN ('price', 'time', 'authority', 'need', 'competitor', 'unknown')),
  CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high'))
);

CREATE INDEX IF NOT EXISTS idx_conversation_objections_conversation ON conversation_objections(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_objections_type ON conversation_objections(type);
