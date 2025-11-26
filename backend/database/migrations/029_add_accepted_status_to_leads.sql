-- Migration 029: Update lead status constraint
-- Adds 'scheduled', 'won', 'lost' states for LinkedIn automation
-- Keeps backward compatibility with existing statuses
-- Status flow: leads -> invite_sent -> accepted -> qualifying -> qualified/discarded OR scheduled -> won/lost

-- Drop existing constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS check_status;

-- Add new constraint with ALL status values (existing + new)
-- Existing: leads, invite_sent, accepted, qualifying, qualified, discarded
-- New: scheduled, won, lost
ALTER TABLE leads ADD CONSTRAINT check_status
  CHECK (status IN (
    'leads',         -- Prospecção (original)
    'lead',          -- Prospecção (alias)
    'invite_sent',   -- Convite enviado
    'accepted',      -- Convite aceito
    'qualifying',    -- Em qualificação
    'qualified',     -- Qualificado
    'discarded',     -- Descartado
    'scheduled',     -- Reunião agendada (novo)
    'won',           -- Ganho/Convertido (novo)
    'lost'           -- Perdido (novo)
  ));

-- Add comment explaining the status flow
COMMENT ON COLUMN leads.status IS 'Lead pipeline status: leads (prospecting) -> invite_sent (invitation sent) -> accepted (invitation accepted) -> qualifying (in qualification) -> qualified/discarded/scheduled -> won/lost';
