-- Migration 121: Add AI profile analysis field to contacts
-- Stores GPT-4o-mini analysis of LinkedIn profile for sales insights

-- Add AI analysis field (JSONB to store structured analysis)
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS ai_profile_analysis JSONB;

-- Add analyzed timestamp
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMP;

-- Create index for finding contacts that need analysis
CREATE INDEX IF NOT EXISTS idx_contacts_ai_analyzed_at ON contacts(ai_analyzed_at);

-- Comments
COMMENT ON COLUMN contacts.ai_profile_analysis IS 'AI-generated profile analysis with summary, key points, and approach hook';
COMMENT ON COLUMN contacts.ai_analyzed_at IS 'When the AI analysis was last performed';
