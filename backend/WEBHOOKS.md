# Webhooks do Unipile - Guia Completo

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Webhooks Disponíveis](#webhooks-disponíveis)
3. [Configuração](#configuração)
4. [Testando Webhooks](#testando-webhooks)
5. [Monitoramento](#monitoramento)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

Os webhooks do Unipile permitem que você receba notificações em tempo real sobre eventos que acontecem nas contas LinkedIn conectadas, como:

- Novas mensagens recebidas
- Convites aceitos
- Reações a mensagens
- Mensagens lidas, editadas ou deletadas

**Arquitetura:**
- Endpoint: `POST /api/webhooks/unipile`
- Todos os webhooks são logados na tabela `webhook_logs`
- Processamento assíncrono com IA
- Sempre retorna HTTP 200 (para evitar reenvios)

---

## 📨 Webhooks Disponíveis

### 1. `message_received` ⭐ PRINCIPAL

**Quando dispara:** Nova mensagem recebida (ou enviada de outro dispositivo)

**Payload:**
```json
{
  "event": "message_received",
  "account_id": "acc_123...",
  "account_type": "LINKEDIN",
  "webhook_name": "my_webhook",
  "timestamp": "2025-01-18T12:00:00Z",
  "chat_id": "chat_456...",
  "message_id": "msg_789...",
  "message": {
    "id": "msg_789...",
    "text": "Olá! Como posso ajudar?",
    "type": "text",
    "timestamp": "2025-01-18T12:00:00Z"
  },
  "sender": {
    "attendee_provider_id": "user_123...",
    "name": "João Silva",
    "profile_url": "https://linkedin.com/in/joao-silva"
  },
  "account_info": {
    "user_id": "your_user_id"
  }
}
```

**⚠️ IMPORTANTE:** Mensagens enviadas pelo próprio usuário (de outro dispositivo) TAMBÉM aparecem aqui!
- Para distinguir: compare `sender.attendee_provider_id` com `account_info.user_id`
- Se iguais: mensagem própria → não processar IA
- Se diferentes: mensagem do lead → processar normalmente

**O que o sistema faz:**
- ✅ Cria ou atualiza conversa
- ✅ Salva mensagem no banco
- ✅ Detecta se é mensagem própria vs lead
- ✅ Atualiza `unread_count` e `last_message_preview`
- ✅ Processa resposta automática com IA (se ativa e se for mensagem do lead)
- ✅ Atualiza status do lead (`invite_sent` → `accepted` se primeira mensagem)

---

### 2. `new_relation` ⏰ DELAY de até 8h

**Quando dispara:** Convite aceito (polling do LinkedIn)

**⚠️ NÃO É TEMPO REAL:** Pode demorar até 8 horas!

**Payload:**
```json
{
  "event": "new_relation",
  "account_id": "acc_123...",
  "account_type": "LINKEDIN",
  "webhook_name": "my_webhook",
  "user_provider_id": "user_456...",
  "user_public_identifier": "joao-silva",
  "user_profile_url": "https://linkedin.com/in/joao-silva",
  "user_full_name": "João Silva",
  "user_picture_url": "https://..."
}
```

**O que o sistema faz:**
- ✅ Busca lead correspondente
- ✅ Atualiza status: `invite_sent` → `accepted`
- ✅ Atualiza log de convites
- ✅ Atualiza contadores da campanha
- ✅ Cria conversa automaticamente
- ✅ Processa mensagem inicial automática (se campanha tiver automação ativa)

**Alternativa mais rápida:**
- Monitorar `message_received` com nota de convite
- Detectar primeira mensagem de um lead com status `invite_sent`

---

### 3. `message_reaction` 👍

**Quando dispara:** Alguém reage a uma mensagem

**Status:** ⚠️ Apenas logado, não persiste no banco ainda

**Payload:**
```json
{
  "event": "message_reaction",
  "account_id": "acc_123...",
  "message_id": "msg_789...",
  "reaction": {
    "emoji": "👍",
    "sender": { ... }
  }
}
```

---

### 4. `message_read` 👁️

**Quando dispara:** Mensagem marcada como lida

**O que o sistema faz:**
- ✅ Marca conversa como lida (`unread_count = 0`)

---

### 5. `message_edited` ✏️

**Quando dispara:** Mensagem editada

**O que o sistema faz:**
- ✅ Atualiza conteúdo da mensagem no banco

---

### 6. `message_deleted` 🗑️

**Quando dispara:** Mensagem deletada

**O que o sistema faz:**
- ✅ Soft delete (mantém no banco com `[Mensagem deletada]`)
- ✅ Marca `deleted_at`

---

### 7. `message_delivered` ✉️

**Quando dispara:** Mensagem entregue

**Status:** ⚠️ Apenas logado, não persiste no banco ainda

---

## ⚙️ Configuração

### 1. Variáveis de Ambiente

Adicione no `.env`:

```env
# Unipile
UNIPILE_DSN=your-dsn.unipile.com
UNIPILE_API_KEY=your_api_key_here

# Webhook
WEBHOOK_URL=https://your-domain.com/api/webhooks/unipile
WEBHOOK_SECRET=your_secret_here  # Opcional, para validação de assinatura
```

### 2. Desenvolvimento Local com ngrok

Para testar localmente, use [ngrok](https://ngrok.com):

```bash
# Instalar ngrok
npm install -g ngrok

# Expor porta 3001
ngrok http 3001

# Copiar URL gerada (ex: https://abc123.ngrok.io)
# Adicionar no .env:
WEBHOOK_URL=https://abc123.ngrok.io/api/webhooks/unipile
```

### 3. Registrar Webhooks no Unipile

```bash
# Registrar todos os webhooks de uma vez
node backend/scripts/register-webhooks.js
```

**O script irá:**
- ✅ Validar configurações do .env
- ✅ Registrar todos os eventos no Unipile
- ✅ Mostrar ID do webhook criado
- ✅ Exibir instruções de teste

---

## 🧪 Testando Webhooks

### Teste 1: Mensagem Recebida

**Passos:**
1. Abra o LinkedIn em outro navegador/dispositivo
2. Envie uma mensagem para uma das suas conexões
3. Peça para a pessoa responder

**Verificar:**
```bash
# Ver logs
curl http://localhost:3001/api/webhooks/logs

# Ver estatísticas
curl http://localhost:3001/api/webhooks/stats
```

**Esperado:**
- Webhook `message_received` logado
- Mensagem salva no banco
- Se IA ativa: resposta automática enviada

---

### Teste 2: Mensagem Própria (de outro dispositivo)

**Passos:**
1. Abra LinkedIn Mobile no celular
2. Envie mensagem para alguém

**Verificar:**
- Webhook recebido com `sender.attendee_provider_id === account_info.user_id`
- Log mostra "📤 Mensagem própria detectada"
- Mensagem salva como `sender_type: 'user'`
- IA **NÃO** processou resposta

---

### Teste 3: Convite Aceito

**Passos:**
1. Envie convite para alguém via campanha
2. Peça para pessoa aceitar

**⏰ AGUARDE até 8 horas!**

**Verificar:**
- Webhook `new_relation` recebido
- Lead atualizado para status `accepted`
- Conversa criada automaticamente
- Se campanha tem automação: mensagem inicial enviada

---

### Teste 4: Reação a Mensagem

**Passos:**
1. Peça para alguém reagir (👍, ❤️, etc) a uma mensagem sua

**Verificar:**
- Webhook `message_reaction` logado
- (Não persiste no banco ainda - TODO)

---

### Teste 5: Editar Mensagem

**Passos:**
1. No LinkedIn, envie uma mensagem
2. Edite a mensagem

**Verificar:**
- Webhook `message_edited` recebido
- Mensagem atualizada no banco

---

## 📊 Monitoramento

### Endpoints de Monitoramento

#### 1. Listar Logs de Webhooks

```bash
GET /api/webhooks/logs?page=1&limit=50&processed=true
```

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "...",
        "event_type": "message_received",
        "payload": { ... },
        "processed": true,
        "error": null,
        "created_at": "2025-01-18T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "pages": 3
    }
  }
}
```

#### 2. Estatísticas de Webhooks

```bash
GET /api/webhooks/stats
```

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "data": {
    "totals": {
      "total": "1500",
      "processed": "1450",
      "pending": "20",
      "with_errors": "30"
    },
    "by_type": [
      {
        "event_type": "message_received",
        "count": "1200",
        "processed": "1180",
        "errors": "20"
      },
      {
        "event_type": "new_relation",
        "count": "150",
        "processed": "150",
        "errors": "0"
      }
    ],
    "recent_activity": [
      {
        "date": "2025-01-18",
        "count": "320"
      }
    ]
  }
}
```

---

## 🔧 Troubleshooting

### Problema 1: Webhooks não estão chegando

**Verificar:**
1. ✅ Webhook registrado no Unipile?
   ```bash
   node backend/scripts/register-webhooks.js
   ```

2. ✅ URL do webhook está acessível?
   ```bash
   curl -X POST https://your-domain.com/api/webhooks/unipile \
     -H "Content-Type: application/json" \
     -d '{"event":"test"}'
   ```

3. ✅ Firewall/CORS bloqueando?

4. ✅ HTTPS configurado? (obrigatório em produção)

---

### Problema 2: Webhook recebido mas erro no processamento

**Verificar logs:**
```sql
SELECT * FROM webhook_logs
WHERE processed = false
ORDER BY created_at DESC
LIMIT 10;
```

**Ver erro específico:**
```sql
SELECT error, payload FROM webhook_logs
WHERE error IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

**Erros comuns:**
- ❌ `LinkedIn account not found` → Conta desconectada
- ❌ `Lead not found` → Lead não existe na campanha
- ❌ `Missing required fields` → Payload incompleto

---

### Problema 3: IA não está respondendo

**Verificar:**
1. ✅ Conversa tem `ai_active = true`?
2. ✅ Conversa NÃO tem `manual_control_taken = true`?
3. ✅ Mensagem é do lead (não própria)?
4. ✅ AI Agent configurado?

**Logs:**
```
🤖 Processando resposta automática com IA...
```

Se não aparecer, verificar condições acima.

---

### Problema 4: `new_relation` demora muito

**É normal!** Pode demorar até 8 horas.

**Alternativa:**
- Use `message_received` como indicador de convite aceito
- Quando receber primeira mensagem de lead com status `invite_sent`
- Automaticamente atualiza para `accepted`

---

## 🔒 Segurança

### Validação de Assinatura (TODO)

O código tem preparação para validar assinaturas HMAC-SHA256:

```javascript
// backend/src/controllers/webhookController.js
// Linhas 24-29

if (process.env.WEBHOOK_SECRET && signature) {
  // TODO: Implementar validação de signature
}
```

**Quando implementado:**
1. Unipile envia header `X-Unipile-Signature`
2. Calcular HMAC-SHA256 do payload com `WEBHOOK_SECRET`
3. Comparar com signature enviada
4. Rejeitar se inválido

---

## 📝 Próximos Passos (Roadmap)

- [ ] Implementar validação de assinatura HMAC
- [ ] Adicionar tabela `message_reactions`
- [ ] Adicionar coluna `delivered_at` em messages
- [ ] Webhook de status da conta (OK, ERROR, CREDENTIALS, etc)
- [ ] Deduplicação de webhooks (evitar processar 2x)
- [ ] Retry mechanism para falhas temporárias
- [ ] Testes automatizados

---

## 📚 Referências

- [Documentação Unipile - New Messages](https://developer.unipile.com/docs/new-messages-webhook)
- [Documentação Unipile - Accepted Invitations](https://developer.unipile.com/docs/detecting-accepted-invitations)
- [Documentação Unipile - Account Lifecycle](https://developer.unipile.com/docs/account-lifecycle)

---

## 🆘 Suporte

**Problemas com webhooks?**

1. Verifique logs: `GET /api/webhooks/logs`
2. Verifique stats: `GET /api/webhooks/stats`
3. Verifique tabela `webhook_logs` no banco
4. Se problema persistir, abra issue no GitHub
