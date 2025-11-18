# 🚀 Sistema de Múltiplas Contas LinkedIn

## ✅ Implementação Completa

Sistema que permite selecionar **múltiplas contas LinkedIn** ao criar uma campanha, distribuindo automaticamente os envios entre elas para multiplicar sua capacidade de prospecção!

---

## 📊 Como Funciona

### Exemplo Prático

**Antes** (uma conta):
- Conta A: 50 convites/dia
- **Total**: 50 convites/dia

**Agora** (múltiplas contas):
- Conta A: 50 convites/dia
- Conta B: 50 convites/dia
- Conta C: 30 convites/dia
- **Total**: **130 convites/dia** 🚀

---

## 🎯 Funcionalidades Implementadas

### 1. Migration: Tabela de Relacionamento

**Arquivo**: [backend/src/migrations/008_add_campaign_linkedin_accounts.js](backend/src/migrations/008_add_campaign_linkedin_accounts.js)

Criada tabela `campaign_linkedin_accounts` (many-to-many) que armazena:
- Relacionamento campanha ↔ contas
- Prioridade de uso (ordem)
- Estatísticas por conta (convites enviados, aceitos)
- `last_used_at` para implementar round-robin
- Flag `is_active` para desativar contas

```sql
CREATE TABLE campaign_linkedin_accounts (
  id UUID PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id),
  linkedin_account_id UUID REFERENCES linkedin_accounts(id),
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  invites_sent INTEGER DEFAULT 0,
  invites_accepted INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(campaign_id, linkedin_account_id)
);
```

**Executar migration**:
```bash
cd backend && node scripts/run-migration-008.js
```

---

### 2. Backend: Criar Campanha

**Arquivo**: [backend/src/controllers/campaignController.js](backend/src/controllers/campaignController.js#L141-L271)

**Endpoint**: `POST /api/campaigns`

**Novo campo**: `linkedin_account_ids` (array)

**Request Body**:
```json
{
  "name": "Campanha Teste",
  "description": "Descrição da campanha",
  "linkedin_account_ids": [
    "account-uuid-1",
    "account-uuid-2",
    "account-uuid-3"
  ],
  "ai_agent_id": "agent-uuid",
  "search_filters": { ... },
  "target_profiles_count": 100
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "campaign-uuid",
    "name": "Campanha Teste",
    "linked_accounts": [
      {
        "id": "account-uuid-1",
        "profile_name": "João Silva",
        "daily_limit": 50
      },
      {
        "id": "account-uuid-2",
        "profile_name": "Maria Santos",
        "daily_limit": 50
      }
    ],
    "total_daily_limit": 100
  }
}
```

**Compatibilidade**: Ainda aceita `linkedin_account_id` (single) para código legado.

---

### 3. Backend: Listagem de Campanhas

**Arquivo**: [backend/src/controllers/campaignController.js](backend/src/controllers/campaignController.js#L65-L105)

Todas as queries de listagem agora retornam:
- `linked_accounts`: Array com todas as contas vinculadas
- `linked_accounts_count`: Número de contas
- `total_daily_limit`: Soma dos limites de todas as contas
- `total_today_sent`: Total de convites enviados hoje por todas as contas

---

### 4. Backend: Distribuição Round-Robin

**Arquivo**: [backend/src/services/inviteAutomationService.js](backend/src/services/inviteAutomationService.js#L385-L451)

#### Função: `getNextAvailableAccount(campaignId)`

Seleciona a próxima conta disponível usando estratégia **Round-Robin**:

1. **Busca contas ativas** vinculadas à campanha
2. **Ordena por**:
   - `last_used_at ASC NULLS FIRST` (menos usada primeiro)
   - `priority ASC` (prioridade como desempate)
3. **Verifica limite** de cada conta
4. **Seleciona primeira** com limite disponível
5. **Atualiza `last_used_at`** para próxima rotação

**Uso**:
```javascript
const inviteAutomationService = require('./services/inviteAutomationService');

// Ao enviar convite
const account = await inviteAutomationService.getNextAvailableAccount(campaignId);

if (account) {
  console.log(`Enviando via: ${account.profile_name}`);
  console.log(`Restantes: ${account.remaining}`);

  // Enviar convite...

  // Incrementar contador
  await inviteAutomationService.incrementAccountInviteSent(campaignId, account.id);
} else {
  console.log('Todas as contas atingiram o limite');
}
```

---

### 5. Frontend: Seleção Múltipla

**Arquivo**: [frontend/src/components/CampaignWizard.jsx](frontend/src/components/CampaignWizard.jsx#L503-L588)

#### Interface com Checkboxes

- **Checkboxes estilizados** para cada conta
- **Visual**:
  - Conta selecionada: borda roxa, fundo lilás
  - Hover: borda cinza
  - Ícone de check verde para contas ativas
- **Informações** por conta:
  - Nome do perfil
  - Limite diário individual
  - Status (ativo/inativo)

#### Resumo de Limites

Card especial mostrando:
- 📊 Quantidade de contas selecionadas
- 🚀 **Limite total disponível** (soma automática)
- 💡 Mensagem: "Os envios serão distribuídos automaticamente"

**Cálculo automático**:
```javascript
const totalLimit = linkedinAccounts
  .filter(acc => formData.linkedin_account_ids.includes(acc.id))
  .reduce((sum, acc) => sum + (acc.daily_limit || 0), 0);
```

---

## 🔄 Fluxo Completo de Envio

### Cenário: Campanha com 3 contas

**Contas configuradas**:
- Conta A: 50 convites/dia (Gustavo)
- Conta B: 50 convites/dia (Isabela)
- Conta C: 30 convites/dia (Rafael)

**Fluxo de envio**:

1. **Lead 1** → Sistema chama `getNextAvailableAccount()`
   - Seleciona **Conta A** (menos usada)
   - Envia convite via Conta A
   - Atualiza `last_used_at` de A
   - Incrementa contador de A

2. **Lead 2** → Sistema chama `getNextAvailableAccount()`
   - Seleciona **Conta B** (agora é a menos usada)
   - Envia convite via Conta B
   - Atualiza `last_used_at` de B

3. **Lead 3** → Sistema chama `getNextAvailableAccount()`
   - Seleciona **Conta C** (agora é a menos usada)
   - Envia convite via Conta C

4. **Lead 4** → Volta para **Conta A** (round-robin)

**Se Conta A atingir limite**:
- Sistema pula A automaticamente
- Continua alternando entre B e C
- Quando todas atingirem limite → para até próximo dia

---

## 📈 Benefícios

1. **Multiplicação de Capacidade**:
   - 3 contas = 3x mais convites/dia

2. **Distribuição Inteligente**:
   - Round-robin garante uso equilibrado
   - Respeita limites individuais
   - Evita sobrecarga em uma conta

3. **Resiliência**:
   - Se uma conta falhar, continua com outras
   - Desativação individual via `is_active`

4. **Analytics**:
   - Estatísticas por conta na campanha
   - Rastreamento de performance individual
   - Histórico de uso (`last_used_at`)

5. **Segurança**:
   - Respeita limites do LinkedIn
   - Comportamento natural (várias contas)
   - Reduz risco de ban

---

## 🧪 Como Testar

### 1. Criar Campanha com Múltiplas Contas

1. Acesse **Campanhas** → **Nova Campanha**
2. Preencha Passos 1 e 2 (busca e coleta)
3. No **Passo 3**, selecione **2 ou mais contas**:
   - Clique nos checkboxes
   - Observe o card de resumo atualizar
   - Veja o limite total aumentar
4. Clique em **Criar Campanha**

### 2. Verificar no Banco de Dados

```sql
-- Ver contas vinculadas a uma campanha
SELECT
  c.name as campaign_name,
  la.profile_name,
  cla.priority,
  cla.is_active,
  cla.invites_sent,
  cla.last_used_at
FROM campaign_linkedin_accounts cla
JOIN campaigns c ON cla.campaign_id = c.id
JOIN linkedin_accounts la ON cla.linkedin_account_id = la.id
WHERE c.id = 'SEU_CAMPAIGN_ID'
ORDER BY cla.priority;
```

### 3. Testar Distribuição

```javascript
// No backend, adicionar logs temporários
const account = await getNextAvailableAccount(campaignId);
console.log('🎯 Conta selecionada:', account.profile_name);
console.log('📊 Limite restante:', account.remaining);
```

Observe os logs:
```
🎯 Lead 1 → Conta: Gustavo (49 restantes)
🎯 Lead 2 → Conta: Isabela (49 restantes)
🎯 Lead 3 → Conta: Rafael (29 restantes)
🎯 Lead 4 → Conta: Gustavo (48 restantes)  // Round-robin
```

---

## 📊 Estrutura de Dados

### Tabela: `campaign_linkedin_accounts`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único |
| `campaign_id` | UUID | Referência à campanha |
| `linkedin_account_id` | UUID | Referência à conta |
| `priority` | INTEGER | Ordem de prioridade (1, 2, 3...) |
| `is_active` | BOOLEAN | Conta ativa para essa campanha? |
| `invites_sent` | INTEGER | Convites enviados desta conta nesta campanha |
| `invites_accepted` | INTEGER | Convites aceitos |
| `last_used_at` | TIMESTAMP | Última vez que foi usada (round-robin) |

### Índices

```sql
CREATE INDEX idx_campaign_linkedin_accounts_campaign
  ON campaign_linkedin_accounts(campaign_id);

CREATE INDEX idx_campaign_linkedin_accounts_linkedin
  ON campaign_linkedin_accounts(linkedin_account_id);

CREATE INDEX idx_campaign_linkedin_accounts_active
  ON campaign_linkedin_accounts(campaign_id, is_active);
```

---

## 🔧 API Endpoints Atualizados

### `POST /api/campaigns`
- **Novo**: Aceita `linkedin_account_ids` (array)
- **Legado**: Ainda aceita `linkedin_account_id` (string)
- **Retorna**: `linked_accounts`, `total_daily_limit`

### `GET /api/campaigns`
- **Retorna**: Cada campanha com `linked_accounts`, `linked_accounts_count`, `total_daily_limit`

### `GET /api/campaigns/:id`
- **Retorna**: Campanha com `linked_accounts` completo

---

## 💡 Próximas Melhorias (Opcionais)

1. **Priorização Manual**: UI para ajustar prioridade das contas
2. **Balanceamento por Performance**: Usar taxa de aceitação para priorizar
3. **Quotas por Conta**: Definir % de distribuição custom (ex: 50% A, 30% B, 20% C)
4. **Fallback Automático**: Se conta falhar, remover da rotação temporariamente
5. **Dashboard Analytics**: Gráficos de performance por conta na campanha
6. **A/B Testing**: Testar diferentes contas em sub-grupos da campanha

---

## ✅ Checklist de Funcionalidades

- [x] Migration da tabela `campaign_linkedin_accounts`
- [x] Backend aceita múltiplas contas ao criar campanha
- [x] Backend retorna contas vinculadas na listagem
- [x] Frontend com seleção múltipla (checkboxes)
- [x] Frontend mostra limite total dinâmico
- [x] Lógica round-robin no `inviteAutomationService`
- [x] Função `getNextAvailableAccount()`
- [x] Função `incrementAccountInviteSent()`
- [x] Compatibilidade com código legado (single account)

---

## 🎉 Resultado Final

Agora você pode:
1. ✅ Selecionar **múltiplas contas** ao criar campanha
2. ✅ Ver **limite total disponível** em tempo real
3. ✅ Sistema **distribui automaticamente** os envios
4. ✅ **Round-robin inteligente** respeita limites
5. ✅ **Multiplica capacidade** de prospecção

**Exemplo real**:
- Antes: 50 convites/dia (1 conta)
- Agora: 200 convites/dia (4 contas x 50) 🚀

---

Desenvolvido com 🤖 por Claude Code
