-- Migration 148: Fix conversation status and sync ai_active/manual_control_taken
-- Corrige conversas que tinham status='active' (deveria ser 'ai_active')
-- e sincroniza os campos ai_active/manual_control_taken com o campo status.

-- 1. Corrigir conversas com status='active' -> 'ai_active'
UPDATE conversations
SET status = 'ai_active'
WHERE status = 'active';

-- 2. Sincronizar ai_active e manual_control_taken com o status
-- Para conversas com status='ai_active': ai_active=true, manual_control_taken=false
UPDATE conversations
SET ai_active = true, manual_control_taken = false
WHERE status = 'ai_active' AND (ai_active = false OR manual_control_taken = true);

-- Para conversas com status='manual': ai_active=false, manual_control_taken=true
UPDATE conversations
SET ai_active = false, manual_control_taken = true
WHERE status = 'manual' AND (ai_active = true OR manual_control_taken = false);

-- Para conversas com status='closed': ai_active=false
UPDATE conversations
SET ai_active = false
WHERE status = 'closed' AND ai_active = true;
