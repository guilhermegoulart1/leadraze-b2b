-- Migration 149: Create onboarding task completions for checklist tracking
-- Tracks which onboarding tasks have been completed by admin for each client

CREATE TABLE IF NOT EXISTS onboarding_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id UUID NOT NULL REFERENCES onboarding_responses(id) ON DELETE CASCADE,
  task_key VARCHAR(100) NOT NULL,
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_by UUID NOT NULL REFERENCES users(id),
  UNIQUE(onboarding_id, task_key)
);

CREATE INDEX idx_onboarding_task_completions_onboarding
  ON onboarding_task_completions(onboarding_id);
