-- Migration 069: Add knowledge_similarity_threshold to ai_agents
-- Controls the minimum similarity score for vector search in the knowledge base
-- Range: 0.0 to 1.0 (default 0.7)
-- Lower values = more results (less precise), Higher values = fewer results (more precise)

ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS knowledge_similarity_threshold DECIMAL(3,2) DEFAULT 0.70;

-- Add constraint to ensure valid range
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_knowledge_similarity_threshold'
  ) THEN
    ALTER TABLE ai_agents
    ADD CONSTRAINT valid_knowledge_similarity_threshold
    CHECK (knowledge_similarity_threshold >= 0.0 AND knowledge_similarity_threshold <= 1.0);
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN ai_agents.knowledge_similarity_threshold IS 'Minimum similarity score (0-1) for knowledge base vector search. Lower = more results, Higher = more precise';
