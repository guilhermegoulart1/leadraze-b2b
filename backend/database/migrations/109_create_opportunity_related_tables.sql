-- Migration 109: Criar tabelas relacionadas a opportunities
-- Fase 1 do plano de migração LEADS -> OPPORTUNITIES

BEGIN;

-- =====================================================
-- TABELA: opportunity_comments (migrar de lead_comments)
-- =====================================================
CREATE TABLE IF NOT EXISTS opportunity_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  attachments JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_opportunity_comments_opportunity ON opportunity_comments(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_comments_user ON opportunity_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_comments_account ON opportunity_comments(account_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_comments_created ON opportunity_comments(created_at DESC);

-- =====================================================
-- TABELA: opportunity_checklists (migrar de lead_checklists)
-- =====================================================
CREATE TABLE IF NOT EXISTS opportunity_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  position INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_checklists_opportunity ON opportunity_checklists(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_checklists_account ON opportunity_checklists(account_id);

-- =====================================================
-- TABELA: opportunity_checklist_items
-- =====================================================
CREATE TABLE IF NOT EXISTS opportunity_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES opportunity_checklists(id) ON DELETE CASCADE,
  content VARCHAR(500) NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  position INTEGER DEFAULT 0,
  due_date DATE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_checklist_items_checklist ON opportunity_checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_checklist_items_assigned ON opportunity_checklist_items(assigned_to);

-- =====================================================
-- TABELA: opportunity_products (migrar de lead_products)
-- =====================================================
CREATE TABLE IF NOT EXISTS opportunity_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(15,2) NOT NULL,
  total_price DECIMAL(15,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_value DECIMAL(15,2) DEFAULT 0,
  payment_conditions TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_products_opportunity ON opportunity_products(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_products_product ON opportunity_products(product_id);

-- =====================================================
-- Adicionar opportunity_id em conversations
-- =====================================================
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_opportunity ON conversations(opportunity_id);

-- =====================================================
-- Adicionar opportunity_id em tasks
-- =====================================================
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_opportunity ON tasks(opportunity_id);

-- =====================================================
-- Adicionar opportunity_id em notifications
-- =====================================================
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_opportunity ON notifications(opportunity_id);

-- =====================================================
-- Triggers para updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para opportunity_comments
DROP TRIGGER IF EXISTS update_opportunity_comments_updated_at ON opportunity_comments;
CREATE TRIGGER update_opportunity_comments_updated_at
  BEFORE UPDATE ON opportunity_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para opportunity_checklists
DROP TRIGGER IF EXISTS update_opportunity_checklists_updated_at ON opportunity_checklists;
CREATE TRIGGER update_opportunity_checklists_updated_at
  BEFORE UPDATE ON opportunity_checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para opportunity_checklist_items
DROP TRIGGER IF EXISTS update_opportunity_checklist_items_updated_at ON opportunity_checklist_items;
CREATE TRIGGER update_opportunity_checklist_items_updated_at
  BEFORE UPDATE ON opportunity_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para opportunity_products
DROP TRIGGER IF EXISTS update_opportunity_products_updated_at ON opportunity_products;
CREATE TRIGGER update_opportunity_products_updated_at
  BEFORE UPDATE ON opportunity_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Comentários
-- =====================================================
COMMENT ON TABLE opportunity_comments IS 'Comentários em oportunidades (migrado de lead_comments)';
COMMENT ON TABLE opportunity_checklists IS 'Checklists em oportunidades (migrado de lead_checklists)';
COMMENT ON TABLE opportunity_checklist_items IS 'Itens de checklists de oportunidades';
COMMENT ON TABLE opportunity_products IS 'Produtos associados a oportunidades (migrado de lead_products)';

COMMIT;
