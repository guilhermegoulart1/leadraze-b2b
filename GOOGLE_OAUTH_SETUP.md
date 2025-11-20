# Configuração do Google OAuth

Este guia explica como configurar o Google OAuth para permitir login com Google na aplicação GetRaze.

## 📋 Pré-requisitos

- Conta Google (Gmail)
- Acesso ao [Google Cloud Console](https://console.cloud.google.com/)

---

## 🚀 Passo a Passo

### 1. Criar Projeto no Google Cloud Console

1. Acesse: https://console.cloud.google.com/
2. Clique em **"Select a project"** no topo da página
3. Clique em **"NEW PROJECT"**
4. Preencha:
   - **Project name**: `GetRaze B2B` (ou nome de sua preferência)
   - **Organization**: Selecione sua organização (se houver)
5. Clique em **"CREATE"**
6. Aguarde a criação do projeto (pode levar alguns segundos)

### 2. Ativar Google+ API (Opcional, mas recomendado)

1. No menu lateral, vá em **"APIs & Services" → "Library"**
2. Busque por `Google+ API`
3. Clique em **"Google+ API"**
4. Clique em **"ENABLE"**

### 3. Configurar OAuth Consent Screen

1. No menu lateral, vá em **"APIs & Services" → "OAuth consent screen"**
2. Selecione **"External"** (para permitir qualquer usuário Google)
3. Clique em **"CREATE"**

#### Preencher Informações do App:

**App information:**
- **App name**: `GetRaze`
- **User support email**: Selecione seu email
- **App logo**: (Opcional) Upload do logo da GetRaze

**App domain:**
- **Application home page**: `http://localhost:5173` (desenvolvimento) ou `https://seudominio.com` (produção)
- **Application privacy policy link**: `http://localhost:5173/privacy` (ou criar página)
- **Application terms of service link**: `http://localhost:5173/terms` (ou criar página)

**Authorized domains:**
- Adicione: `localhost` (para desenvolvimento)
- Adicione: seu domínio de produção (ex: `getraze.com`)

**Developer contact information:**
- **Email addresses**: Seu email de contato

4. Clique em **"SAVE AND CONTINUE"**

#### Scopes (Permissões):

1. Clique em **"ADD OR REMOVE SCOPES"**
2. Selecione os scopes:
   - ✅ `.../auth/userinfo.email` - Ver endereço de email
   - ✅ `.../auth/userinfo.profile` - Ver informações pessoais básicas
   - ✅ `openid` - Autenticar usando OpenID Connect
3. Clique em **"UPDATE"**
4. Clique em **"SAVE AND CONTINUE"**

#### Test users (Desenvolvimento):

1. Clique em **"ADD USERS"**
2. Adicione emails que poderão testar (enquanto o app estiver em modo teste)
3. Clique em **"ADD"**
4. Clique em **"SAVE AND CONTINUE"**

5. Revise as informações e clique em **"BACK TO DASHBOARD"**

### 4. Criar Credenciais OAuth 2.0

1. No menu lateral, vá em **"APIs & Services" → "Credentials"**
2. Clique em **"+ CREATE CREDENTIALS"** no topo
3. Selecione **"OAuth client ID"**

#### Configurar OAuth Client:

- **Application type**: Selecione `Web application`
- **Name**: `GetRaze Web Client`

**Authorized JavaScript origins:**
- Adicione: `http://localhost:5173` (Frontend - desenvolvimento)
- Adicione: `http://localhost:3001` (Backend - desenvolvimento)
- Adicione: `https://seudominio.com` (produção)

**Authorized redirect URIs:**
- Adicione: `http://localhost:3001/api/auth/google/callback` (desenvolvimento)
- Adicione: `https://api.seudominio.com/api/auth/google/callback` (produção)

4. Clique em **"CREATE"**

### 5. Copiar Credenciais

Após criar, aparecerá um modal com suas credenciais:

1. **Copie o Client ID** - algo como: `123456789-abc123.apps.googleusercontent.com`
2. **Copie o Client Secret** - algo como: `GOCSPX-abc123xyz789`
3. Clique em **"OK"**

💡 **Dica**: Se perder as credenciais, você pode visualizá-las novamente clicando no nome do OAuth client na lista de credenciais.

---

## 🔧 Configurar no Backend

### 1. Atualizar arquivo `.env`

Edite o arquivo `backend/.env` e adicione suas credenciais:

```env
# Google OAuth
GOOGLE_CLIENT_ID=seu_client_id_aqui
GOOGLE_CLIENT_SECRET=seu_client_secret_aqui
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

### 2. Executar Migration

Execute a migration para adicionar os campos necessários no banco de dados:

```bash
cd backend
node scripts/run-migration-011.js
```

Você deve ver:
```
✅ Migration 011 executed successfully!
```

---

## ✅ Testar o Login

### 1. Iniciar Aplicação

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

### 2. Testar Login com Google

1. Acesse: http://localhost:5173/login
2. Clique no botão **"Google"**
3. Selecione sua conta Google
4. Autorize as permissões solicitadas
5. Você será redirecionado de volta para a aplicação logado

### 3. Verificar Dados no Banco

```sql
SELECT id, email, name, google_id, avatar_url, is_active
FROM users
WHERE google_id IS NOT NULL;
```

---

## 🚨 Troubleshooting

### Erro: "redirect_uri_mismatch"

**Causa**: A URL de redirect não está configurada no Google Console.

**Solução**:
1. Vá em **"APIs & Services" → "Credentials"**
2. Clique no nome do seu OAuth client
3. Adicione a URL exata em **"Authorized redirect URIs"**: `http://localhost:3001/api/auth/google/callback`
4. Clique em **"SAVE"**
5. Aguarde alguns minutos para propagar
6. Tente novamente

### Erro: "Access blocked: This app's request is invalid"

**Causa**: OAuth consent screen não está configurado corretamente.

**Solução**:
1. Vá em **"APIs & Services" → "OAuth consent screen"**
2. Verifique se o status é **"Testing"** ou **"Published"**
3. Se estiver em **"Testing"**, adicione seu email em **"Test users"**

### Erro: "invalid_client"

**Causa**: Client ID ou Client Secret incorretos.

**Solução**:
1. Verifique se copiou as credenciais corretamente no `.env`
2. Não deve ter espaços antes ou depois das credenciais
3. Reinicie o backend após alterar o `.env`

### Usuário não é redirecionado após login

**Causa**: FRONTEND_URL está incorreto no `.env`

**Solução**:
1. Verifique se `FRONTEND_URL=http://localhost:5173` no backend `.env`
2. Certifique-se que não tem `/` no final

---

## 📊 Próximos Passos

### Para Produção:

1. **Publicar OAuth Consent Screen**:
   - Vá em **"OAuth consent screen"**
   - Clique em **"PUBLISH APP"**
   - Preencha formulário de verificação do Google (se necessário)

2. **Atualizar Credenciais de Produção**:
   - Adicione domínio de produção em **"Authorized domains"**
   - Adicione URLs de produção em **"Authorized redirect URIs"**
   - Atualize `.env` de produção com as mesmas credenciais

3. **Configurar HTTPS**:
   - Google OAuth requer HTTPS em produção
   - Configure certificado SSL (Let's Encrypt, Cloudflare, etc.)

---

## 🔐 Segurança

⚠️ **IMPORTANTE**:
- NUNCA commite o arquivo `.env` no Git
- NUNCA exponha o `GOOGLE_CLIENT_SECRET` publicamente
- Use variáveis de ambiente no servidor de produção
- Rotacione as credenciais se houver suspeita de vazamento

---

## 📚 Referências

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Passport.js Google Strategy](http://www.passportjs.org/packages/passport-google-oauth20/)
- [Google Cloud Console](https://console.cloud.google.com/)

---

✅ **Pronto!** Seu Google OAuth está configurado e funcionando!
