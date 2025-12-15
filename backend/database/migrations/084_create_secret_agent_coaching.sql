-- Migration 084: Create secret_agent_coaching table
-- Stores AI coaching sessions using SPIN Selling methodology

BEGIN;

-- Create secret_agent_coaching table
CREATE TABLE IF NOT EXISTS secret_agent_coaching (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Input from user
  objective TEXT NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  difficulties TEXT,

  -- Context analyzed
  messages_analyzed INTEGER DEFAULT 30,

  -- AI response
  ai_response TEXT NOT NULL,
  spin_techniques_used JSONB,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_secret_agent_coaching_account_id ON secret_agent_coaching(account_id);
CREATE INDEX IF NOT EXISTS idx_secret_agent_coaching_conversation_id ON secret_agent_coaching(conversation_id);
CREATE INDEX IF NOT EXISTS idx_secret_agent_coaching_user_id ON secret_agent_coaching(user_id);
CREATE INDEX IF NOT EXISTS idx_secret_agent_coaching_created_at ON secret_agent_coaching(created_at DESC);

COMMIT;
