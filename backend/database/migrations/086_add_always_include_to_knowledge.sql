-- Migration: Add always_include field to ai_agent_knowledge
-- Description: Allows marking knowledge items as "essential" so they're always included in the agent's context
-- regardless of vector search similarity scores

-- Add the always_include column
ALTER TABLE ai_agent_knowledge
ADD COLUMN IF NOT EXISTS always_include BOOLEAN DEFAULT false;

-- Create partial index for fast lookup of essential knowledge
CREATE INDEX IF NOT EXISTS idx_ai_agent_knowledge_always_include
ON ai_agent_knowledge(ai_agent_id, always_include)
WHERE always_include = true;

-- Add comment explaining the field
COMMENT ON COLUMN ai_agent_knowledge.always_include IS
'When true, this knowledge item is always included in the agent context, regardless of vector search similarity. Use for essential product information that the agent must always know.';
