# Sistema Inteligente de Health Score e Limites LinkedIn

## ✅ FASE 1 IMPLEMENTADA

### 📁 Arquivos Criados

1. **[backend/src/migrations/007_add_account_health_tracking.sql](backend/src/migrations/007_add_account_health_tracking.sql)**
   - Adiciona campos `account_type` e `accepted_at`
   - Cria tabelas `linkedin_account_limit_changes` e `linkedin_account_health_metrics`
   - Função SQL `calculate_account_health_metrics()`
   - View `vw_linkedin_account_health`

2. **[backend/scripts/run-migration-007.js](backend/scripts/run-migration-007.js)**
   - Script para executar a migration

3. **[backend/src/services/accountHealthService.js](backend/src/services/accountHealthService.js)**
   - `detectAccountType()` - Auto-detecta tipo de conta
   - `calculateHealthScore()` - Calcula score 0-100
   - `getAcceptanceRate()` - Taxa de aceitação de convites
   - `getRecommendedLimit()` - Limite recomendado inteligente
   - `checkRiskPatterns()` - Detecta padrões de risco
   - `logLimitChange()` - Registra alterações de limite

### 🔄 Arquivos Modificados

1. **[backend/src/controllers/profileController.js](backend/src/controllers/profileController.js)**
   - Auto-detecção de tipo de conta ao conectar/atualizar
   - Sugestão automática de limite seguro
   - 4 novos endpoints:
     - `getAccountHealth()` - GET /linkedin-accounts/:id/health
     - `getRecommendedLimit()` - GET /linkedin-accounts/:id/recommended-limit
     - `overrideLimit()` - POST /linkedin-accounts/:id/override-limit
     - `getLimitHistory()` - GET /linkedin-accounts/:id/limit-history

2. **[backend/src/routes/profiles.js](backend/src/routes/profiles.js)**
   - Rotas para os 4 novos endpoints

3. **[backend/src/controllers/webhookController.js](backend/src/controllers/webhookController.js#L286-L301)**
   - Atualiza status de convite para 'accepted' quando webhook recebido
   - Registra timestamp de aceitação

---

## 🚀 Como Usar

### 1. Executar Migration

```bash
# Opção 1: Via script Node.js (ajustar credenciais)
node backend/scripts/run-migration-007.js

# Opção 2: Via psql direto
psql -h localhost -U postgres -d leadraze -f backend/src/migrations/007_add_account_health_tracking.sql
```

### 2. Testar Auto-Detecção de Tipo

Quando você clicar em "Atualizar" (botão azul) em uma conta LinkedIn:
- ✅ O sistema detecta automaticamente: Free, Premium, Sales Navigator ou Recruiter
- ✅ Atualiza o campo `account_type` no banco
- ✅ Sugere limite seguro se não tiver configurado

### 3. Usar Novos Endpoints

#### 📊 GET Health Score
```bash
GET /api/profiles/linkedin-accounts/:id/health

Response:
{
  "success": true,
  "data": {
    "health_score": 85,
    "risk_level": "low",
    "account_age_days": 120,
    "metrics": {
      "acceptance_rate_7d": 45.5,
      "acceptance_rate_30d": 42.3,
      "invites_sent_30d": 120,
      "invites_accepted_30d": 51,
      "avg_response_time_hours": 18.5
    },
    "factors": [
      {
        "factor": "acceptance_rate_30d",
        "impact": 10,
        "message": "Taxa de aceitação excelente (42.3%)"
      }
    ],
    "risks": [],
    "account_type": "premium"
  }
}
```

#### 💡 GET Limite Recomendado
```bash
GET /api/profiles/linkedin-accounts/:id/recommended-limit?strategy=moderate

Strategies: safe | moderate | aggressive

Response:
{
  "success": true,
  "data": {
    "recommended": 50,
    "min": 30,
    "max": 65,
    "account_type": "premium",
    "strategy": "moderate",
    "health_score": 85,
    "adjustment_factors": [
      {
        "factor": "health_score",
        "multiplier": 1.1,
        "message": "Health score excelente (85/100): aumentado em 10%"
      }
    ],
    "current_limit": 60
  }
}
```

#### ⚠️ POST Override Manual de Limite
```bash
POST /api/profiles/linkedin-accounts/:id/override-limit
Content-Type: application/json

{
  "new_limit": 80,
  "reason": "Cliente solicitou aumento para campanha especial"
}

Response:
{
  "success": true,
  "data": {
    "old_limit": 50,
    "new_limit": 80,
    "recommended_limit": 50,
    "is_above_recommended": true,
    "risk_level": "medium"
  }
}
```

#### 📜 GET Histórico de Alterações
```bash
GET /api/profiles/linkedin-accounts/:id/limit-history?limit=20

Response:
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "uuid",
        "old_limit": 50,
        "new_limit": 80,
        "recommended_limit": 50,
        "is_manual_override": true,
        "reason": "Cliente solicitou aumento",
        "risk_level": "medium",
        "account_health_score": 85,
        "acceptance_rate": 42.3,
        "created_at": "2025-01-18T10:30:00Z"
      }
    ],
    "current_limit": 80
  }
}
```

---

## 📊 Health Score - Como Funciona

### Cálculo do Score (0-100)

**Base: 100 pontos**

#### Penalizações:

| Fator | Condição | Penalidade |
|-------|----------|------------|
| Idade da conta | < 30 dias | -20 pontos |
| Idade da conta | < 90 dias | -10 pontos |
| Taxa aceitação 30d | < 15% | -30 pontos |
| Taxa aceitação 30d | < 25% | -15 pontos |
| Taxa aceitação 30d | < 35% | -5 pontos |
| Taxa aceitação 7d | < 15% | -15 pontos |
| Volume 30d | > 800 convites | -20 pontos |
| Volume 30d | > 500 convites | -10 pontos |
| Conta inativa | status != 'active' | -50 pontos |

#### Bonificações:

| Fator | Condição | Bonificação |
|-------|----------|-------------|
| Idade da conta | > 365 dias | +5 pontos |
| Taxa aceitação 30d | >= 50% | +10 pontos |

### Níveis de Risco

| Score | Nível | Descrição |
|-------|-------|-----------|
| 70-100 | `low` | Conta saudável ✅ |
| 50-69 | `medium` | Atenção necessária ⚠️ |
| 0-49 | `high` | Risco alto 🚨 |

---

## 🎯 Limites Recomendados

### Por Tipo de Conta

| Tipo | Seguro | Moderado | Agressivo | Máx Recomendado |
|------|--------|----------|-----------|-----------------|
| **Free** | 25/dia | 30/dia | 35/dia | 40/dia |
| **Premium** | 45/dia | 55/dia | 65/dia | 70/dia |
| **Sales Navigator** | 70/dia | 90/dia | 110/dia | 120/dia |
| **Recruiter** | 110/dia | 130/dia | 160/dia | 180/dia |

### Ajustes Dinâmicos

O limite recomendado é ajustado automaticamente baseado em:

1. **Health Score**
   - Score < 50: Reduz 50%
   - Score < 70: Reduz 30%
   - Score >= 90: Aumenta 10%

2. **Idade da Conta**
   - < 30 dias: Reduz 50%
   - < 90 dias: Reduz 30%
   - > 365 dias: Aumenta 20%

---

## ⚠️ Detecção de Riscos

### Padrões Monitorados

1. **Taxa de Aceitação Crítica**
   - < 15% nos últimos 7 dias
   - Nível: HIGH
   - Ação: Pausar envios, revisar targeting

2. **Volume Excessivo**
   - Próximo de 90% do limite diário
   - Nível: MEDIUM
   - Ação: Aguardar até amanhã

3. **Limite Acima do Recomendado**
   - > 30% acima do recomendado
   - Nível: MEDIUM/HIGH
   - Ação: Monitorar de perto

4. **Conta Nova com Limite Alto**
   - < 30 dias + limite > 30
   - Nível: HIGH
   - Ação: Reduzir para 15-20/dia

5. **Health Score Baixo**
   - Score < 50
   - Nível: HIGH
   - Ação: Revisar estratégia completa

---

## 📝 Logs de Alteração

Toda alteração de limite é registrada em `linkedin_account_limit_changes` com:

- Limite antigo e novo
- Limite recomendado no momento
- Quem alterou (user_id)
- Se foi override manual
- Motivo da alteração
- Health score no momento
- Taxa de aceitação no momento
- Nível de risco da alteração

**Exemplo de consulta:**

```sql
SELECT
  old_limit,
  new_limit,
  recommended_limit,
  is_manual_override,
  reason,
  risk_level,
  account_health_score,
  acceptance_rate,
  created_at
FROM linkedin_account_limit_changes
WHERE linkedin_account_id = 'uuid'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🔮 Próximos Passos (FASE 2)

### Frontend - Dashboard de Health

- [ ] Card de Health Score com gauge visual
- [ ] Estatísticas 7d/30d com gráficos
- [ ] Modal de configuração de limites
- [ ] Slider com avisos de risco
- [ ] Histórico de alterações com timeline
- [ ] Alertas de risco em tempo real

### Melhorias Backend

- [ ] Notificações por email para alertas críticos
- [ ] Distribuição temporal de convites (throttling)
- [ ] Análise preditiva de aceitação
- [ ] A/B testing de mensagens

---

## 🧪 Testes

### Testar Health Score

```bash
# 1. Conectar ou atualizar uma conta LinkedIn
# (isso preenche account_type e premium_features)

# 2. Consultar health score
curl http://localhost:3001/api/profiles/linkedin-accounts/{id}/health \
  -H "Authorization: Bearer {token}"

# 3. Consultar limite recomendado
curl http://localhost:3001/api/profiles/linkedin-accounts/{id}/recommended-limit \
  -H "Authorization: Bearer {token}"

# 4. Fazer override de limite
curl -X POST http://localhost:3001/api/profiles/linkedin-accounts/{id}/override-limit \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "new_limit": 80,
    "reason": "Teste de override manual"
  }'

# 5. Ver histórico
curl http://localhost:3001/api/profiles/linkedin-accounts/{id}/limit-history \
  -H "Authorization: Bearer {token}"
```

---

## 📌 Notas Importantes

1. **Migration é obrigatória** - Execute antes de usar os novos endpoints
2. **Webhooks já atualizam** - Convites aceitos são automaticamente tracked
3. **Auto-detecção funciona** - Ao clicar em "Atualizar" conta no frontend
4. **Logs são automáticos** - Toda alteração de limite é registrada
5. **Limites são inteligentes** - Consideram múltiplos fatores

---

## 🎉 Benefícios

✅ **Inteligência Automática**
- Sistema sugere limites baseados em tipo de conta + health score + idade

✅ **Transparência Total**
- Cliente vê o limite recomendado antes de fazer override

✅ **Rastreabilidade Completa**
- Todos os overrides são logados com motivo

✅ **Prevenção de Riscos**
- Sistema alerta sobre padrões perigosos

✅ **Dados em Tempo Real**
- Taxa de aceitação calculada dinamicamente

---

Desenvolvido com 🤖 por Claude Code
