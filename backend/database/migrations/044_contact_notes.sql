-- Migration: 044_contact_notes.sql
-- Description: Add contact notes/observations table
-- Date: 2024-12-03

-- =============================================
-- 1. CREATE CONTACT_NOTES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS contact_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 2. INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_contact_notes_contact_id ON contact_notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_notes_account_id ON contact_notes(account_id);
CREATE INDEX IF NOT EXISTS idx_contact_notes_created_at ON contact_notes(created_at DESC);

-- =============================================
-- 3. COMMENTS
-- =============================================

COMMENT ON TABLE contact_notes IS 'Internal notes/observations about contacts';
COMMENT ON COLUMN contact_notes.content IS 'The note content';
COMMENT ON COLUMN contact_notes.user_id IS 'User who created the note';
