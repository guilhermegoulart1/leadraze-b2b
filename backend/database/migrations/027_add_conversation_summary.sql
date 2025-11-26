-- Migration: Add progressive summary fields to conversations table
-- Purpose: Store rolling summaries for long conversations to optimize AI context and reduce token costs

-- Add summary fields to conversations table
ALTER TABLE conversations
ADD COLUMN context_summary TEXT,
ADD COLUMN summary_up_to_message_id UUID,
ADD COLUMN summary_token_count INTEGER DEFAULT 0,
ADD COLUMN summary_updated_at TIMESTAMP,
ADD COLUMN messages_count INTEGER DEFAULT 0;

-- Add index for efficient summary retrieval
CREATE INDEX idx_conversations_summary_updated ON conversations(summary_updated_at) WHERE context_summary IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN conversations.context_summary IS 'Progressive summary of conversation history, updated incrementally as new messages arrive';
COMMENT ON COLUMN conversations.summary_up_to_message_id IS 'Last message ID included in the current summary';
COMMENT ON COLUMN conversations.summary_token_count IS 'Approximate token count of the current summary';
COMMENT ON COLUMN conversations.summary_updated_at IS 'Timestamp when summary was last updated';
COMMENT ON COLUMN conversations.messages_count IS 'Total number of messages in the conversation';
