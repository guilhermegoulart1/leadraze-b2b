# Fix: Erro "missing FROM-clause entry for table c" ao deletar campanha

## Problema

Ao tentar deletar uma campanha do LinkedIn, está aparecendo o erro:
```
missing FROM-clause entry for table "c"
```

Este erro geralmente acontece quando há uma VIEW, TRIGGER ou CONSTRAINT no banco de dados que tem uma query SQL malformada usando o alias "c".

## Possíveis Causas

1. **VIEW `account_stats`**: Esta view usa o alias `c` para a tabela `campaigns`. Quando você deleta uma campanha, o PostgreSQL pode estar tentando atualizar essa view e causando o erro.

2. **TRIGGER mal formado**: Pode haver um trigger em uma tabela relacionada (`leads`, `conversations`, `bulk_collection_jobs`) que usa SQL incorreto.

3. **CONSTRAINT CHECK**: Alguma constraint CHECK pode ter uma subquery malformada.

## Diagnóstico

### Opção 1: Usar o script de diagnóstico completo

Execute este comando para diagnosticar o problema:

```bash
cd backend
node scripts/diagnose-campaign-delete.js
```

Este script irá:
- Encontrar uma campanha para testar
- Verificar todos os triggers nas tabelas relacionadas
- Verificar foreign keys e constraints
- Tentar deletar (com rollback) para ver o erro exato

### Opção 2: Usar o script SQL direto

Se preferir executar SQL diretamente:

```bash
psql -U postgres -d leadraze -f backend/scripts/fix-campaign-delete-issue.sql
```

## Soluções

### Solução 1: Recriar a VIEW account_stats

Execute este SQL no banco de dados:

```sql
BEGIN;

-- Dropar a view existente
DROP VIEW IF EXISTS account_stats CASCADE;

-- Recriar a view
CREATE VIEW account_stats AS
SELECT
  a.id as account_id,
  a.name as account_name,
  a.slug,
  a.plan,
  a.is_active,
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT c.id) as total_campaigns,
  COUNT(DISTINCT l.id) as total_leads,
  COUNT(DISTINCT ct.id) as total_contacts,
  COUNT(DISTINCT cn.id) as total_conversations,
  a.created_at
FROM accounts a
LEFT JOIN users u ON u.account_id = a.id
LEFT JOIN campaigns c ON c.account_id = a.id
LEFT JOIN leads l ON l.account_id = a.id
LEFT JOIN contacts ct ON ct.account_id = a.id
LEFT JOIN conversations cn ON cn.account_id = a.id
GROUP BY a.id, a.name, a.slug, a.plan, a.is_active, a.created_at;

COMMIT;
```

### Solução 2: Identificar e corrigir TRIGGER problemático

Se o problema for um trigger, execute:

```sql
-- Listar todos os triggers nas tabelas relacionadas
SELECT
  tgname AS trigger_name,
  tgrelid::regclass AS table_name,
  pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid IN ('campaigns'::regclass, 'leads'::regclass, 'conversations'::regclass)
  AND tgisinternal = false;
```

Procure por qualquer trigger que use o alias "c" de forma incorreta.

### Solução 3: Desabilitar temporariamente triggers (NÃO RECOMENDADO)

**ATENÇÃO**: Esta solução é apenas temporária para debug. NÃO use em produção!

```sql
BEGIN;

-- Desabilitar triggers temporariamente
ALTER TABLE campaigns DISABLE TRIGGER ALL;
ALTER TABLE leads DISABLE TRIGGER ALL;
ALTER TABLE conversations DISABLE TRIGGER ALL;

-- Deletar campanha
DELETE FROM campaigns WHERE id = 'seu_campaign_id_aqui';

-- Reabilitar triggers
ALTER TABLE campaigns ENABLE TRIGGER ALL;
ALTER TABLE leads ENABLE TRIGGER ALL;
ALTER TABLE conversations ENABLE TRIGGER ALL;

COMMIT;
```

## Teste Final

Depois de aplicar a solução, teste deletando uma campanha:

```bash
# Via backend (API)
curl -X DELETE http://localhost:3001/api/campaigns/{campaign_id} \
  -H "Authorization: Bearer {seu_token}"

# Via SQL direto
DELETE FROM campaigns WHERE id = '{campaign_id}';
```

## Scripts Criados

- [`diagnose-campaign-delete.js`](./diagnose-campaign-delete.js) - Script Node.js para diagnóstico completo
- [`fix-campaign-delete-issue.sql`](./fix-campaign-delete-issue.sql) - Script SQL para diagnóstico
- Este arquivo ([`CAMPAIGN_DELETE_FIX.md`](./CAMPAIGN_DELETE_FIX.md)) - Guia de correção

## Próximos Passos

1. Execute o script de diagnóstico
2. Identifique a causa exata do erro
3. Aplique a solução apropriada
4. Teste novamente

Se o problema persistir, compartilhe a saída do script de diagnóstico para análise mais detalhada.
