-- Migration: Create Roadmaps System
-- Description: Creates tables for roadmaps (reusable task sequences)

-- ============================================
-- ROADMAPS (Templates)
-- ============================================
CREATE TABLE IF NOT EXISTS roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Basic info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  shortcut VARCHAR(50), -- for "/" trigger in chat (e.g., /onboarding)

  -- Scope settings
  is_global BOOLEAN DEFAULT false, -- visible to entire account or just creator
  is_active BOOLEAN DEFAULT true,

  -- Default participants (can be overridden on execution)
  default_assignees UUID[] DEFAULT '{}',

  -- Total duration (calculated automatically from tasks)
  total_duration_hours INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE roadmaps IS 'Templates of reusable task sequences (roadmaps)';
COMMENT ON COLUMN roadmaps.shortcut IS 'Shortcut for "/" trigger in chat (without the slash)';
COMMENT ON COLUMN roadmaps.is_global IS 'If true, visible to entire account. If false, only to creator';

-- Indexes
CREATE INDEX idx_roadmaps_account ON roadmaps(account_id);
CREATE INDEX idx_roadmaps_created_by ON roadmaps(created_by);
CREATE INDEX idx_roadmaps_active ON roadmaps(account_id, is_active);
CREATE INDEX idx_roadmaps_shortcut ON roadmaps(account_id, shortcut) WHERE shortcut IS NOT NULL;
CREATE UNIQUE INDEX idx_roadmaps_unique_shortcut ON roadmaps(account_id, LOWER(shortcut)) WHERE shortcut IS NOT NULL AND is_active = true;

-- ============================================
-- ROADMAP TASKS (Template Tasks)
-- ============================================
CREATE TABLE IF NOT EXISTS roadmap_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,

  -- Task info
  title VARCHAR(255) NOT NULL,
  description TEXT,
  task_type VARCHAR(50) DEFAULT 'other', -- call, meeting, email, follow_up, proposal, other
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent

  -- Relative deadline (from roadmap start or previous task)
  relative_due_hours INTEGER NOT NULL DEFAULT 24, -- hours after reference point
  relative_due_from VARCHAR(20) DEFAULT 'roadmap_start', -- 'roadmap_start' or 'previous_task'

  -- Default assignee (optional)
  default_assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Ordering
  position INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE roadmap_tasks IS 'Tasks within a roadmap template';
COMMENT ON COLUMN roadmap_tasks.relative_due_hours IS 'Deadline in hours from roadmap start or previous task';
COMMENT ON COLUMN roadmap_tasks.relative_due_from IS 'Reference for calculation: roadmap_start or previous_task';

-- Indexes
CREATE INDEX idx_roadmap_tasks_roadmap ON roadmap_tasks(roadmap_id);
CREATE INDEX idx_roadmap_tasks_position ON roadmap_tasks(roadmap_id, position);

-- ============================================
-- ROADMAP EXECUTIONS (Running Instances)
-- ============================================
CREATE TABLE IF NOT EXISTS roadmap_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID REFERENCES roadmaps(id) ON DELETE SET NULL,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Execution context
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  -- Who executed
  started_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Status and dates
  status VARCHAR(20) DEFAULT 'in_progress', -- in_progress, completed, cancelled
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_reason TEXT,

  -- Snapshot of roadmap at execution time (for history)
  roadmap_name VARCHAR(255) NOT NULL,
  roadmap_snapshot JSONB, -- copy of tasks for audit

  -- Metrics
  total_tasks INTEGER NOT NULL DEFAULT 0,
  completed_tasks INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE roadmap_executions IS 'Instances of roadmaps executed on contacts/opportunities';
COMMENT ON COLUMN roadmap_executions.roadmap_snapshot IS 'Snapshot of roadmap to maintain history even if template is changed';

-- Indexes
CREATE INDEX idx_roadmap_executions_roadmap ON roadmap_executions(roadmap_id);
CREATE INDEX idx_roadmap_executions_contact ON roadmap_executions(contact_id);
CREATE INDEX idx_roadmap_executions_opportunity ON roadmap_executions(opportunity_id);
CREATE INDEX idx_roadmap_executions_conversation ON roadmap_executions(conversation_id);
CREATE INDEX idx_roadmap_executions_status ON roadmap_executions(status);
CREATE INDEX idx_roadmap_executions_started_by ON roadmap_executions(started_by);
CREATE INDEX idx_roadmap_executions_account ON roadmap_executions(account_id);
CREATE INDEX idx_roadmap_executions_account_status ON roadmap_executions(account_id, status);

-- ============================================
-- ROADMAP EXECUTION TASKS (Actual Tasks)
-- ============================================
CREATE TABLE IF NOT EXISTS roadmap_execution_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES roadmap_executions(id) ON DELETE CASCADE,
  roadmap_task_id UUID REFERENCES roadmap_tasks(id) ON DELETE SET NULL,

  -- Task data (copied from template)
  title VARCHAR(255) NOT NULL,
  description TEXT,
  task_type VARCHAR(50) DEFAULT 'other',
  priority VARCHAR(20) DEFAULT 'medium',
  position INTEGER NOT NULL DEFAULT 0,

  -- Calculated dates
  due_date TIMESTAMP WITH TIME ZONE,

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE roadmap_execution_tasks IS 'Actual tasks created from a roadmap execution';

-- Indexes
CREATE INDEX idx_roadmap_exec_tasks_execution ON roadmap_execution_tasks(execution_id);
CREATE INDEX idx_roadmap_exec_tasks_status ON roadmap_execution_tasks(status);
CREATE INDEX idx_roadmap_exec_tasks_due_date ON roadmap_execution_tasks(due_date);
CREATE INDEX idx_roadmap_exec_tasks_is_completed ON roadmap_execution_tasks(is_completed);
CREATE INDEX idx_roadmap_exec_tasks_position ON roadmap_execution_tasks(execution_id, position);

-- ============================================
-- ROADMAP EXECUTION TASK ASSIGNEES (Responsible Users)
-- ============================================
CREATE TABLE IF NOT EXISTS roadmap_execution_task_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_task_id UUID NOT NULL REFERENCES roadmap_execution_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notified_at TIMESTAMP WITH TIME ZONE, -- when user was notified

  UNIQUE(execution_task_id, user_id)
);

COMMENT ON TABLE roadmap_execution_task_assignees IS 'Users assigned to roadmap execution tasks';

-- Indexes
CREATE INDEX idx_roadmap_exec_task_assignees_task ON roadmap_execution_task_assignees(execution_task_id);
CREATE INDEX idx_roadmap_exec_task_assignees_user ON roadmap_execution_task_assignees(user_id);

-- ============================================
-- TRIGGER: Update updated_at on roadmaps
-- ============================================
CREATE OR REPLACE FUNCTION update_roadmaps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_roadmaps_updated_at
  BEFORE UPDATE ON roadmaps
  FOR EACH ROW
  EXECUTE FUNCTION update_roadmaps_updated_at();

CREATE TRIGGER trigger_roadmap_executions_updated_at
  BEFORE UPDATE ON roadmap_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_roadmaps_updated_at();

CREATE TRIGGER trigger_roadmap_execution_tasks_updated_at
  BEFORE UPDATE ON roadmap_execution_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_roadmaps_updated_at();

-- ============================================
-- TRIGGER: Update total_duration_hours on roadmaps
-- ============================================
CREATE OR REPLACE FUNCTION update_roadmap_total_duration()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE roadmaps
  SET total_duration_hours = (
    SELECT COALESCE(SUM(relative_due_hours), 0)
    FROM roadmap_tasks
    WHERE roadmap_id = COALESCE(NEW.roadmap_id, OLD.roadmap_id)
  )
  WHERE id = COALESCE(NEW.roadmap_id, OLD.roadmap_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_roadmap_duration_insert
  AFTER INSERT ON roadmap_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_roadmap_total_duration();

CREATE TRIGGER trigger_update_roadmap_duration_update
  AFTER UPDATE OF relative_due_hours ON roadmap_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_roadmap_total_duration();

CREATE TRIGGER trigger_update_roadmap_duration_delete
  AFTER DELETE ON roadmap_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_roadmap_total_duration();

-- ============================================
-- TRIGGER: Update completed_tasks count on executions
-- ============================================
CREATE OR REPLACE FUNCTION update_execution_completed_tasks()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE roadmap_executions
  SET
    completed_tasks = (
      SELECT COUNT(*)
      FROM roadmap_execution_tasks
      WHERE execution_id = COALESCE(NEW.execution_id, OLD.execution_id)
      AND is_completed = true
    ),
    status = CASE
      WHEN (
        SELECT COUNT(*)
        FROM roadmap_execution_tasks
        WHERE execution_id = COALESCE(NEW.execution_id, OLD.execution_id)
        AND is_completed = true
      ) = (
        SELECT total_tasks
        FROM roadmap_executions
        WHERE id = COALESCE(NEW.execution_id, OLD.execution_id)
      ) THEN 'completed'
      ELSE status
    END,
    completed_at = CASE
      WHEN (
        SELECT COUNT(*)
        FROM roadmap_execution_tasks
        WHERE execution_id = COALESCE(NEW.execution_id, OLD.execution_id)
        AND is_completed = true
      ) = (
        SELECT total_tasks
        FROM roadmap_executions
        WHERE id = COALESCE(NEW.execution_id, OLD.execution_id)
      ) THEN CURRENT_TIMESTAMP
      ELSE completed_at
    END
  WHERE id = COALESCE(NEW.execution_id, OLD.execution_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_execution_completed_tasks
  AFTER UPDATE OF is_completed ON roadmap_execution_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_execution_completed_tasks();
