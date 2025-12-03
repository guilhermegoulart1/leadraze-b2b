-- Migration: 044_add_unipile_attachment_id.sql
-- Description: Add unipile_attachment_id to email_attachments for R2 fallback lookup
-- Date: 2024

-- Add column to store the original Unipile attachment ID
-- This allows us to lookup attachments saved in R2 by their Unipile ID
ALTER TABLE email_attachments
ADD COLUMN IF NOT EXISTS unipile_attachment_id VARCHAR(255);

-- Index for fast lookup by unipile_attachment_id
CREATE INDEX IF NOT EXISTS idx_email_attachments_unipile_id
ON email_attachments(unipile_attachment_id);

-- Index for the combined lookup (conversation + unipile_id)
CREATE INDEX IF NOT EXISTS idx_email_attachments_conv_unipile
ON email_attachments(conversation_id, unipile_attachment_id);
