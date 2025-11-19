# 🔗 Gerenciamento de Webhooks Unipile

Guia completo para gerenciar webhooks do Unipile no LeadRaze.

---

## 📋 Scripts Disponíveis

### 1. **Listar Webhooks**
Lista todos os webhooks registrados no seu DSN.

```bash
node backend/scripts/list-webhooks.js
```

**Quando usar:**
- Ver quais webhooks estão ativos
- Descobrir IDs de webhooks para deletar/atualizar
- Verificar URLs e eventos configurados

**Exemplo de saída:**
```
📋 Listando Webhooks do Unipile

📍 DSN: api3.unipile.com:13332

✅ 2 webhook(s) encontrado(s):

📌 Webhook #1
   ID: Pca406ioQG-O2sKRGzoDEw
   URL: https://6067a6704e12.ngrok-free.app/api/webhooks/unipile
   Source: messaging
   Events: message_received, message_reaction, message_read, ...

📌 Webhook #2
   ID: 4cycoVzYTBWRxxxbCICBVA
   URL: https://6067a6704e12.ngrok-free.app/api/webhooks/unipile
   Source: users
   Events: new_relation
```

---

### 2. **Deletar Webhook**
Remove um webhook específico do Unipile.

```bash
node backend/scripts/delete-webhook.js {webhook_id}
```

**Quando usar:**
- Trocar de ambiente (dev → produção)
- Remover webhooks duplicados
- Limpar webhooks antigos

**Exemplo:**
```bash
# Primeiro, liste para pegar o ID
node backend/scripts/list-webhooks.js

# Depois delete usando o ID
node backend/scripts/delete-webhook.js Pca406ioQG-O2sKRGzoDEw
```

**Saída:**
```
🗑️  Deletando Webhook do Unipile
🎯 Webhook ID: Pca406ioQG-O2sKRGzoDEw

✅ Webhook deletado com sucesso!
```

---

### 3. **Atualizar Webhook**
Atualiza a URL de um webhook existente sem precisar deletar e recriar.

```bash
node backend/scripts/update-webhook.js {webhook_id} {nova_url}
```

**Quando usar:**
- Trocar de ngrok para URL de produção
- Atualizar domínio sem recriar webhooks
- Trocar de porta/servidor

**Exemplo:**
```bash
node backend/scripts/update-webhook.js Pca406ioQG-O2sKRGzoDEw https://app.leadraze.com/api/webhooks/unipile
```

**Saída:**
```
🔄 Atualizando Webhook do Unipile
🎯 Webhook ID: Pca406ioQG-O2sKRGzoDEw
🔗 Nova URL: https://app.leadraze.com/api/webhooks/unipile

✅ Webhook atualizado com sucesso!
```

---

### 4. **Registrar Webhooks**
Cria novos webhooks no Unipile (2 webhooks: messaging + users).

```bash
node backend/scripts/register-webhooks.js
```

**Quando usar:**
- Primeira configuração do projeto
- Após deletar todos os webhooks
- Configurar ambiente novo (staging, produção)

**Lê do .env:**
- `UNIPILE_DSN`
- `UNIPILE_ACCESS_TOKEN`
- `WEBHOOK_URL`

---

## 🚀 Workflows Comuns

### 📱 Desenvolvimento Local com ngrok

**1. Iniciar ngrok:**
```bash
ngrok http 3001
```

**2. Copiar URL do ngrok:**
```
https://6067a6704e12.ngrok-free.app
```

**3. Adicionar no .env:**
```env
WEBHOOK_URL=https://6067a6704e12.ngrok-free.app/api/webhooks/unipile
```

**4. Registrar webhooks:**
```bash
node backend/scripts/register-webhooks.js
```

**5. Testar:**
- Envie uma mensagem no LinkedIn
- Verifique os logs: `GET http://localhost:3001/api/webhooks/logs`

---

### 🌐 Deploy para Produção

**Cenário:** Você estava usando ngrok e agora vai publicar o backend.

**Opção 1: Atualizar webhooks existentes (recomendado)**
```bash
# 1. Listar webhooks atuais
node backend/scripts/list-webhooks.js

# 2. Copiar os IDs dos 2 webhooks

# 3. Atualizar cada webhook
node backend/scripts/update-webhook.js Pca406ioQG-O2sKRGzoDEw https://app.leadraze.com/api/webhooks/unipile
node backend/scripts/update-webhook.js 4cycoVzYTBWRxxxbCICBVA https://app.leadraze.com/api/webhooks/unipile

# 4. Verificar
node backend/scripts/list-webhooks.js
```

**Opção 2: Deletar e recriar**
```bash
# 1. Listar webhooks
node backend/scripts/list-webhooks.js

# 2. Deletar webhooks antigos (ngrok)
node backend/scripts/delete-webhook.js Pca406ioQG-O2sKRGzoDEw
node backend/scripts/delete-webhook.js 4cycoVzYTBWRxxxbCICBVA

# 3. Atualizar .env
# WEBHOOK_URL=https://app.leadraze.com/api/webhooks/unipile

# 4. Registrar novos webhooks
node backend/scripts/register-webhooks.js

# 5. Verificar
node backend/scripts/list-webhooks.js
```

---

### 🔄 Trocar URL do Backend

Se você mudou o domínio/IP do servidor:

```bash
# Listar webhooks atuais
node backend/scripts/list-webhooks.js

# Atualizar cada um com nova URL
node backend/scripts/update-webhook.js {id_webhook_1} https://novo-dominio.com/api/webhooks/unipile
node backend/scripts/update-webhook.js {id_webhook_2} https://novo-dominio.com/api/webhooks/unipile
```

---

### 🧹 Limpar Webhooks Duplicados

Se você registrou webhooks múltiplas vezes por engano:

```bash
# 1. Listar todos
node backend/scripts/list-webhooks.js

# 2. Deletar os duplicados (manter apenas os mais recentes)
node backend/scripts/delete-webhook.js {id_webhook_antigo_1}
node backend/scripts/delete-webhook.js {id_webhook_antigo_2}

# 3. Confirmar que restaram apenas 2 webhooks (messaging + users)
node backend/scripts/list-webhooks.js
```

---

## ⚙️ Configuração do .env

Os scripts precisam destas variáveis no `.env`:

```env
# Unipile (obrigatório)
UNIPILE_DSN=api3.unipile.com:13332
UNIPILE_ACCESS_TOKEN=your_token_here

# Webhook URL (obrigatório para register-webhooks.js)
WEBHOOK_URL=https://seu-dominio.com/api/webhooks/unipile
```

### 🔑 Como encontrar suas credenciais:

1. **UNIPILE_DSN:**
   - Painel Unipile → Settings → API
   - Formato: `apiX.unipile.com:XXXXX`

2. **UNIPILE_ACCESS_TOKEN:**
   - Painel Unipile → Settings → API Keys
   - Criar nova chave se necessário

3. **WEBHOOK_URL:**
   - **Desenvolvimento:** URL do ngrok + `/api/webhooks/unipile`
   - **Produção:** Domínio do seu backend + `/api/webhooks/unipile`

---

## 🐛 Troubleshooting

### Erro: "UNIPILE_DSN e UNIPILE_ACCESS_TOKEN devem estar configurados"

**Solução:**
Verifique se o arquivo `.env` existe em `backend/.env` com as credenciais corretas.

---

### Erro: "Webhook não encontrado" (404)

**Solução:**
O ID do webhook está incorreto ou já foi deletado.
```bash
# Liste webhooks disponíveis
node backend/scripts/list-webhooks.js
```

---

### Erro: "URL inválida"

**Solução:**
A URL deve começar com `http://` ou `https://`.

**Correto:**
```
https://app.leadraze.com/api/webhooks/unipile
```

**Incorreto:**
```
app.leadraze.com/api/webhooks/unipile  ❌ (falta https://)
```

---

### Webhooks não estão recebendo eventos

**Checklist:**
1. ✅ Webhooks estão registrados?
   ```bash
   node backend/scripts/list-webhooks.js
   ```

2. ✅ URL está correta e acessível?
   ```bash
   curl -X POST https://sua-url.com/api/webhooks/unipile \
     -H "Content-Type: application/json" \
     -d '{"event":"test"}'
   ```

3. ✅ Backend está rodando?
   ```bash
   # Verificar se porta 3001 está escutando
   curl http://localhost:3001/health
   ```

4. ✅ ngrok está rodando? (se desenvolvimento local)
   ```bash
   ngrok http 3001
   ```

5. ✅ Firewall bloqueando?
   - Produção: Liberar porta 443 (HTTPS)
   - Desenvolvimento: ngrok deve estar ativo

---

## 📊 Monitoramento

### Ver logs de webhooks recebidos:

**Endpoint:**
```
GET http://localhost:3001/api/webhooks/logs
```

**Com autenticação:**
```bash
curl http://localhost:3001/api/webhooks/logs \
  -H "Authorization: Bearer {seu_token}"
```

### Ver estatísticas:

```
GET http://localhost:3001/api/webhooks/stats
```

---

## 🆘 Comandos Úteis

### Listar tudo de uma vez:
```bash
# Linux/Mac
echo "=== WEBHOOKS ===" && \
node backend/scripts/list-webhooks.js

# Windows
echo === WEBHOOKS === && node backend/scripts/list-webhooks.js
```

### Deletar todos os webhooks:
```bash
# 1. Listar e copiar IDs
node backend/scripts/list-webhooks.js

# 2. Deletar um por um
node backend/scripts/delete-webhook.js {id_1}
node backend/scripts/delete-webhook.js {id_2}
```

### Resetar webhooks (deletar tudo e recriar):
```bash
# Deletar webhooks antigos
node backend/scripts/delete-webhook.js {id_webhook_1}
node backend/scripts/delete-webhook.js {id_webhook_2}

# Registrar novos
node backend/scripts/register-webhooks.js
```

---

## 📝 Notas Importantes

1. **Sempre mantenha 2 webhooks:**
   - 1 para `messaging` (source)
   - 1 para `users` (source)

2. **O Unipile envia webhooks para TODAS as contas conectadas no DSN:**
   - Se você tem múltiplas contas LinkedIn, receberá webhooks de todas
   - O sistema filtra automaticamente baseado em `linkedin_accounts.unipile_account_id`

3. **Webhooks `new_relation` podem demorar até 8 horas:**
   - É normal! É polling do LinkedIn
   - Alternativa: Use `message_received` como indicador de convite aceito

4. **HTTPS é obrigatório em produção:**
   - Unipile não aceita HTTP em produção
   - Use certificado SSL válido

---

## 🔗 Links Úteis

- [Documentação Unipile - Webhooks](https://developer.unipile.com/docs/webhooks)
- [Documentação Unipile - Eventos](https://developer.unipile.com/docs/events)
- [ngrok - Túnel para localhost](https://ngrok.com)

---

## 📞 Suporte

**Problemas com webhooks?**

1. Verifique logs: `GET /api/webhooks/logs`
2. Verifique stats: `GET /api/webhooks/stats`
3. Liste webhooks: `node backend/scripts/list-webhooks.js`
4. Consulte este README
5. Veja documentação: `backend/WEBHOOKS.md`
