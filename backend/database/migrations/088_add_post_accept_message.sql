-- Migration 088: Add post_accept_message to ai_agents
-- Purpose: Store a different message to send after invite is accepted (vs invite message)

-- Add post_accept_message column
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS post_accept_message TEXT;

-- Add comment for documentation
COMMENT ON COLUMN ai_agents.post_accept_message IS 'Message sent by AI after LinkedIn invite is accepted. Different from invite_message.';
