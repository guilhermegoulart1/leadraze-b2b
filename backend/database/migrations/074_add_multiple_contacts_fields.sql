-- Migration 074: Add multiple contacts fields
-- Purpose: Store multiple emails, phones, social links and team members from website scraping
-- Date: 2024-12-14

-- Add JSONB fields for multiple contact data
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS emails JSONB DEFAULT '[]';

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS phones JSONB DEFAULT '[]';

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS team_members JSONB DEFAULT '[]';

-- Comments explaining the structure
COMMENT ON COLUMN contacts.emails IS 'Array of emails: [{"email": "...", "type": "commercial|support|personal", "department": "..."}]';
COMMENT ON COLUMN contacts.phones IS 'Array of phones: [{"phone": "...", "type": "landline|mobile|whatsapp"}]';
COMMENT ON COLUMN contacts.social_links IS 'Social media links: {"linkedin": "url", "instagram": "url", "facebook": "url", "youtube": "url"}';
COMMENT ON COLUMN contacts.team_members IS 'Team members found: [{"name": "...", "role": "...", "email": "...", "linkedin": "..."}]';

-- Index for searching in JSONB arrays (GIN index)
CREATE INDEX IF NOT EXISTS idx_contacts_emails_gin ON contacts USING GIN (emails);
CREATE INDEX IF NOT EXISTS idx_contacts_phones_gin ON contacts USING GIN (phones);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 074 completed: multiple contacts fields added';
END $$;
