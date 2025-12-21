-- Migration 090: Fix answer column NULL constraint
-- Purpose: Allow NULL in answer column for document, product_info, case_study types
-- These types use the 'content' field instead of 'answer'

-- Remove NOT NULL constraint from answer column
ALTER TABLE ai_agent_knowledge
ALTER COLUMN answer DROP NOT NULL;

-- Add comment for clarification
COMMENT ON COLUMN ai_agent_knowledge.answer IS 'Resposta para FAQs/Objeções. NULL para document, product_info, case_study (usam content)';
