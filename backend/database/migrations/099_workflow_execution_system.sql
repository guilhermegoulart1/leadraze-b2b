-- Migration 099: Workflow Execution System
-- Purpose: Create tables and columns for workflow execution engine, test sessions, and logging

-- =====================================================
-- 1. ADD WORKFLOW COLUMNS TO AI_AGENTS
-- =====================================================

-- Add workflow_definition to ai_agents (stores React Flow nodes/edges)
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS workflow_definition JSONB;

-- Add workflow_enabled flag to ai_agents
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS workflow_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN ai_agents.workflow_definition IS 'React Flow nodes and edges for visual workflow execution';
COMMENT ON COLUMN ai_agents.workflow_enabled IS 'When true, uses workflow engine instead of simple conversation_steps';

-- =====================================================
-- 2. CREATE CONVERSATION_WORKFLOW_STATE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS conversation_workflow_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,

  -- Current state
  current_node_id VARCHAR(100),
  workflow_definition JSONB NOT NULL, -- Snapshot of workflow at conversation start

  -- Variables and context
  variables JSONB DEFAULT '{}',
  step_history JSONB DEFAULT '[]', -- Array of visited nodes

  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed', 'transferred')),
  paused_until TIMESTAMP WITH TIME ZONE,
  paused_reason TEXT,

  -- Resume info (for pause/resume functionality)
  resume_node_id VARCHAR(100),
  resume_job_id VARCHAR(100), -- Bull job ID for scheduled resume

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(conversation_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_state_conversation ON conversation_workflow_state(conversation_id);
CREATE INDEX IF NOT EXISTS idx_workflow_state_agent ON conversation_workflow_state(agent_id);
CREATE INDEX IF NOT EXISTS idx_workflow_state_status ON conversation_workflow_state(status);
CREATE INDEX IF NOT EXISTS idx_workflow_state_paused ON conversation_workflow_state(status, paused_until)
  WHERE status = 'paused';

COMMENT ON TABLE conversation_workflow_state IS 'Tracks workflow execution state for each conversation';

-- =====================================================
-- 3. CREATE AGENT_TEST_SESSIONS TABLE
-- =====================================================
-- NOTE: workflow_execution_logs table was removed - logs are returned in real-time during tests only

CREATE TABLE IF NOT EXISTS agent_test_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'ended')),

  -- State
  workflow_state JSONB DEFAULT '{}', -- Current workflow state for test
  current_node_id VARCHAR(100),

  -- Messages (stored directly, not in separate table for test sessions)
  messages JSONB DEFAULT '[]', -- Array of {role, content, timestamp, metadata}

  -- Lead simulation data
  lead_simulation JSONB DEFAULT '{}', -- {name, company, title, industry, etc.}

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_test_sessions_agent ON agent_test_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_user ON agent_test_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_account ON agent_test_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_status ON agent_test_sessions(status);
CREATE INDEX IF NOT EXISTS idx_test_sessions_active ON agent_test_sessions(user_id, status)
  WHERE status = 'active';

COMMENT ON TABLE agent_test_sessions IS 'Test sessions for trying agents without affecting real conversations';

-- =====================================================
-- 4. CREATE SCHEDULED_WORKFLOW_ACTIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS scheduled_workflow_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  workflow_state_id UUID REFERENCES conversation_workflow_state(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,

  -- Action details
  action_type VARCHAR(50) NOT NULL, -- resume_workflow, check_no_response, follow_up
  node_id VARCHAR(100), -- Node to resume at
  action_data JSONB DEFAULT '{}', -- Additional data for the action

  -- Scheduling
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  bull_job_id VARCHAR(100), -- Reference to Bull queue job

  -- Status
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'completed', 'cancelled', 'failed')),
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_conversation ON scheduled_workflow_actions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_scheduled ON scheduled_workflow_actions(scheduled_for, status)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_job ON scheduled_workflow_actions(bull_job_id);

COMMENT ON TABLE scheduled_workflow_actions IS 'Tracks scheduled workflow actions (pause, follow-up, etc.)';

-- =====================================================
-- 5. ADD TRIGGER FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_workflow_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_workflow_state_updated_at ON conversation_workflow_state;
CREATE TRIGGER trigger_workflow_state_updated_at
  BEFORE UPDATE ON conversation_workflow_state
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_state_updated_at();

DROP TRIGGER IF EXISTS trigger_scheduled_actions_updated_at ON scheduled_workflow_actions;
CREATE TRIGGER trigger_scheduled_actions_updated_at
  BEFORE UPDATE ON scheduled_workflow_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_state_updated_at();

-- =====================================================
-- 6. CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to get workflow state with agent info
DROP FUNCTION IF EXISTS get_workflow_state_with_agent(UUID);
CREATE OR REPLACE FUNCTION get_workflow_state_with_agent(p_conversation_id UUID)
RETURNS TABLE (
  state_id UUID,
  conversation_id UUID,
  agent_id UUID,
  agent_name VARCHAR,
  current_node_id VARCHAR,
  workflow_definition JSONB,
  variables JSONB,
  step_history JSONB,
  status VARCHAR,
  paused_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cws.id AS state_id,
    cws.conversation_id,
    cws.agent_id,
    aa.name AS agent_name,
    cws.current_node_id,
    cws.workflow_definition,
    cws.variables,
    cws.step_history,
    cws.status,
    cws.paused_until,
    cws.created_at,
    cws.updated_at
  FROM conversation_workflow_state cws
  JOIN ai_agents aa ON cws.agent_id = aa.id
  WHERE cws.conversation_id = p_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean old test sessions (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_test_sessions(retention_days INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete old ended test sessions
  WITH deleted AS (
    DELETE FROM agent_test_sessions
    WHERE status = 'ended'
      AND ended_at < NOW() - (retention_days || ' days')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_workflow_state_with_agent IS 'Get workflow state with agent name for a conversation';
COMMENT ON FUNCTION cleanup_old_test_sessions IS 'Remove old ended test sessions (default: 7 days)';
