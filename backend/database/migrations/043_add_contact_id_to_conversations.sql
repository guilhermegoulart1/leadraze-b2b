-- Migration: 043_add_contact_id_to_conversations.sql
-- Description: Add contact_id to conversations for organic/WhatsApp contacts
-- Date: 2024-12-02

-- =============================================
-- 1. ADD CONTACT_ID TO CONVERSATIONS
-- =============================================
-- Conversations can now be linked to contacts directly (for organic/WhatsApp)
-- instead of requiring a lead from a campaign

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- =============================================
-- 2. MAKE LEAD_ID OPTIONAL
-- =============================================
-- lead_id can be NULL for organic conversations

ALTER TABLE conversations
ALTER COLUMN lead_id DROP NOT NULL;

-- =============================================
-- 3. ADD CHECK CONSTRAINT
-- =============================================
-- A conversation must have either a contact_id or lead_id (or both)

-- First drop existing constraint if any
ALTER TABLE conversations
DROP CONSTRAINT IF EXISTS check_conversation_has_contact_or_lead;

-- Add new constraint (allow at least one to be present)
-- We allow both to be NULL temporarily during creation, but normally one should exist
-- ALTER TABLE conversations
-- ADD CONSTRAINT check_conversation_has_contact_or_lead
-- CHECK (contact_id IS NOT NULL OR lead_id IS NOT NULL);

-- =============================================
-- 4. ADD INDEX FOR CONTACT_ID
-- =============================================

CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON conversations(contact_id);

-- =============================================
-- 5. UPDATE CONVERSATIONS STATUS CONSTRAINT
-- =============================================
-- Add 'closed' status if not already allowed

ALTER TABLE conversations
DROP CONSTRAINT IF EXISTS check_conversation_status;

ALTER TABLE conversations
ADD CONSTRAINT check_conversation_status
CHECK (status IN ('ai_active', 'manual', 'closed'));

-- =============================================
-- 6. ADD COMMENTS
-- =============================================

COMMENT ON COLUMN conversations.contact_id IS 'Reference to contact for organic/WhatsApp conversations (can coexist with lead_id)';
