-- Migration: 051_create_tasks.sql
-- Description: Create tasks table for task management system
-- Linked to leads with Monday-style board visualization

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  task_type VARCHAR(50) DEFAULT 'other', -- call, meeting, email, follow_up, proposal, other
  status VARCHAR(50) DEFAULT 'pending',  -- pending, in_progress, completed, cancelled
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  reminder_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add comments
COMMENT ON TABLE tasks IS 'Tasks linked to leads for activity tracking';
COMMENT ON COLUMN tasks.task_type IS 'Task type: call, meeting, email, follow_up, proposal, other';
COMMENT ON COLUMN tasks.status IS 'Task status: pending, in_progress, completed, cancelled';
COMMENT ON COLUMN tasks.priority IS 'Task priority: low, medium, high, urgent';
COMMENT ON COLUMN tasks.due_date IS 'When the task is due';
COMMENT ON COLUMN tasks.completed_at IS 'When the task was completed';
COMMENT ON COLUMN tasks.reminder_at IS 'When to send a reminder notification';

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_account ON tasks(account_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lead ON tasks(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;

-- Composite index for board queries (grouping by date and filtering by user/account)
CREATE INDEX IF NOT EXISTS idx_tasks_board_query ON tasks(account_id, assigned_to, status, due_date);

-- Index for overdue tasks query
CREATE INDEX IF NOT EXISTS idx_tasks_overdue ON tasks(account_id, due_date, status)
  WHERE status NOT IN ('completed', 'cancelled') AND due_date IS NOT NULL;

-- Add task_type column if it doesn't exist (for existing databases)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'task_type') THEN
    ALTER TABLE tasks ADD COLUMN task_type VARCHAR(50) DEFAULT 'other';
  END IF;
END $$;
