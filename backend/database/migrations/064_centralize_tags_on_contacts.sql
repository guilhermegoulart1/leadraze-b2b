-- Migration: 064_centralize_tags_on_contacts.sql
-- Description: Centralizar tags no CONTATO como fonte única de verdade
-- Oportunidades e Conversas herdam tags do contato vinculado

-- 1. Migrar tags existentes de lead_tags para contact_tags (via contact_leads)
INSERT INTO contact_tags (contact_id, tag_id, created_at)
SELECT DISTINCT cl.contact_id, lt.tag_id, lt.created_at
FROM lead_tags lt
JOIN contact_leads cl ON cl.lead_id = lt.lead_id
WHERE NOT EXISTS (
  SELECT 1 FROM contact_tags ct
  WHERE ct.contact_id = cl.contact_id AND ct.tag_id = lt.tag_id
)
ON CONFLICT (contact_id, tag_id) DO NOTHING;

-- 2. Criar índices para otimizar as queries de herança de tags
CREATE INDEX IF NOT EXISTS idx_contact_leads_lead_id ON contact_leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_contact_leads_contact_id ON contact_leads(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_contact_id ON contact_tags(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_tag_id ON contact_tags(tag_id);

-- 3. Marcar lead_tags como deprecated
COMMENT ON TABLE lead_tags IS 'DEPRECATED: Use contact_tags instead. Tags are now centralized on contacts. Kept for backward compatibility.';

-- 4. Adicionar comentário explicativo na tabela contact_tags
COMMENT ON TABLE contact_tags IS 'Primary table for tag associations. All entities (leads/opportunities, conversations) inherit tags from their linked contact.';
