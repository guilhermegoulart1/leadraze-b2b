# 🌍 Guia de Internacionalização (i18n) - LeadRaze B2B

## ✅ Status da Implementação

### Completo
- ✅ Sistema i18n configurado (react-i18next + i18next)
- ✅ 3 idiomas suportados: **Inglês (padrão)**, Português, Espanhol
- ✅ Detecção automática de idioma do navegador
- ✅ Banco de dados atualizado (campos `preferred_language` e `timezone`)
- ✅ API endpoint para salvar preferência: `PUT /api/users/language`
- ✅ Componente LanguageSelector (com bandeiras 🇺🇸 🇧🇷 🇪🇸)
- ✅ LoginPage traduzido
- ✅ Layout + Navegação traduzidos

### Pendente
- ⏳ Dashboard
- ⏳ Campanhas (CampaignsPage, CampaignWizard)
- ⏳ Pipeline de Leads (LeadsPage)
- ⏳ Contatos (ContactsPage, ContactListsPage)
- ⏳ Conversas (ConversationsPage)
- ⏳ AI Agents
- ⏳ ~20 outras páginas e componentes

---

## 📂 Estrutura de Arquivos

```
frontend/src/
├── i18n.js                          # Configuração do i18n
├── locales/
│   ├── en/
│   │   ├── common.json              # Botões, status, mensagens comuns
│   │   ├── auth.json                # Login, registro
│   │   └── navigation.json          # Menu, navegação
│   ├── pt/
│   │   └── [mesma estrutura]
│   └── es/
│       └── [mesma estrutura]
└── components/
    └── LanguageSelector.jsx         # Seletor de idioma

backend/src/
├── config/
│   └── i18n.js                      # Configuração backend
├── locales/
│   ├── en/
│   │   ├── errors.json              # Mensagens de erro
│   │   └── messages.json            # Mensagens de sucesso
│   ├── pt/
│   │   └── [mesma estrutura]
│   └── es/
│       └── [mesma estrutura]
└── controllers/
    └── userController.js            # Endpoint updateLanguage
```

---

## 🚀 Como Usar nos Componentes

### Exemplo Básico

```jsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation('namespace'); // 'common', 'auth', 'navigation'

  return (
    <div>
      <h1>{t('title')}</h1>
      <button>{t('buttons.save')}</button>
      <p>{t('messages.success')}</p>
    </div>
  );
}
```

### Com Múltiplos Namespaces

```jsx
const { t } = useTranslation(['common', 'auth']);

<button>{t('common:buttons.save')}</button>
<p>{t('auth:login.title')}</p>
```

### Com Interpolação

```json
// locales/en/messages.json
{
  "welcome": "Welcome, {{name}}!",
  "itemsCount": "You have {{count}} items"
}
```

```jsx
<h1>{t('welcome', { name: user.name })}</h1>
<p>{t('itemsCount', { count: 5 })}</p>
```

---

## 📝 Como Traduzir um Novo Componente

### Passo 1: Identificar Textos

Identifique todos os textos hardcoded no componente:

```jsx
// ❌ Antes (hardcoded)
<h1>Bem-vindo ao Dashboard</h1>
<button>Criar Campanha</button>
<p>Você tem 5 leads novos</p>
```

### Passo 2: Adicionar Traduções aos Arquivos JSON

Crie um novo namespace ou use um existente. Exemplo para `dashboard.json`:

```json
// locales/en/dashboard.json
{
  "title": "Welcome to Dashboard",
  "createCampaign": "Create Campaign",
  "newLeads": "You have {{count}} new leads"
}
```

```json
// locales/pt/dashboard.json
{
  "title": "Bem-vindo ao Dashboard",
  "createCampaign": "Criar Campanha",
  "newLeads": "Você tem {{count}} leads novos"
}
```

```json
// locales/es/dashboard.json
{
  "title": "Bienvenido al Dashboard",
  "createCampaign": "Crear Campaña",
  "newLeads": "Tienes {{count}} nuevos leads"
}
```

### Passo 3: Registrar Novo Namespace (se necessário)

Edite `frontend/src/i18n.js`:

```js
import enDashboard from './locales/en/dashboard.json';
import ptDashboard from './locales/pt/dashboard.json';
import esDashboard from './locales/es/dashboard.json';

const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    navigation: enNavigation,
    dashboard: enDashboard, // ✅ Adicionar aqui
  },
  // ... pt e es
};

i18n.init({
  // ...
  ns: ['common', 'auth', 'navigation', 'dashboard'], // ✅ E aqui
});
```

### Passo 4: Usar no Componente

```jsx
// ✅ Depois (traduzido)
import { useTranslation } from 'react-i18next';

function Dashboard() {
  const { t } = useTranslation('dashboard');

  return (
    <div>
      <h1>{t('title')}</h1>
      <button>{t('createCampaign')}</button>
      <p>{t('newLeads', { count: 5 })}</p>
    </div>
  );
}
```

---

## 🎨 Componente LanguageSelector

### Uso Básico

```jsx
import LanguageSelector from './components/LanguageSelector';

// Variante dropdown (para settings)
<LanguageSelector variant="dropdown" />

// Variante compacta (para menu/header)
<LanguageSelector variant="compact" />
```

**Funcionalidades:**
- Salva automaticamente no backend (`PUT /api/users/language`)
- Usa localStorage como cache
- Atualiza i18n instantaneamente
- Mostra bandeiras visuais (🇺🇸 🇧🇷 🇪🇸)

---

## 🔧 API Backend

### Endpoint de Atualização de Idioma

```http
PUT /api/users/language
Authorization: Bearer <token>
Content-Type: application/json

{
  "language": "pt"  // "en", "pt", ou "es"
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "Language preference updated successfully",
  "language": "pt",
  "timezone": "America/Sao_Paulo"
}
```

### Usar i18n em Controllers

```js
// backend/src/controllers/myController.js
exports.myAction = async (req, res) => {
  try {
    // req.t() está disponível via middleware
    sendSuccess(res, {
      message: req.t('messages:general.success')
    });
  } catch (error) {
    sendError(res, error);
  }
};
```

---

## 🗂️ Organização de Chaves

### Estrutura Recomendada

```json
{
  "buttons": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete"
  },
  "forms": {
    "name": "Name",
    "email": "Email",
    "password": "Password"
  },
  "messages": {
    "success": "Operation completed successfully",
    "error": "An error occurred"
  },
  "validation": {
    "required": "This field is required",
    "invalidEmail": "Invalid email address"
  }
}
```

### Namespaces por Feature

- **common.json** - Elementos compartilhados (botões, status, mensagens gerais)
- **auth.json** - Autenticação (login, registro, recuperação de senha)
- **navigation.json** - Menu, navegação, breadcrumbs
- **dashboard.json** - Dashboard específico
- **campaigns.json** - Campanhas
- **leads.json** - Leads e pipeline
- **contacts.json** - Contatos
- **errors.json** - Mensagens de erro

---

## 🌐 Detecção de Idioma

### Ordem de Prioridade

1. **Preferência salva no banco** (se usuário já escolheu)
2. **LocalStorage** (`i18nextLng`)
3. **Accept-Language header** (navegador)
4. **Fallback: Inglês** (padrão)

### Para Usuários Logados
- Idioma sincroniza entre dispositivos
- Salvo na tabela `users.preferred_language`

### Para Visitantes
- Usa localStorage + detecção do navegador
- Ao fazer login, preferência é salva no banco

---

## 🧪 Testando

### Testar Detecção Automática

1. Mudar idioma do navegador para português
2. Limpar localStorage: `localStorage.clear()`
3. Recarregar página
4. ✅ Deve detectar português automaticamente

### Testar Troca Manual

1. Clicar no LanguageSelector (🇺🇸 🇧🇷 🇪🇸)
2. Selecionar um idioma
3. ✅ Página deve atualizar instantaneamente
4. ✅ Preferência salva no banco (verificar no dev tools Network)

### Verificar no Banco de Dados

```sql
SELECT email, preferred_language, timezone FROM users;
```

---

## 📋 Checklist para Traduzir Nova Página

- [ ] Identificar todos os textos hardcoded
- [ ] Criar arquivo JSON de tradução (`en`, `pt`, `es`)
- [ ] Registrar namespace no `i18n.js` (se novo)
- [ ] Importar `useTranslation` no componente
- [ ] Substituir textos por `t('key')`
- [ ] Testar em todos os 3 idiomas
- [ ] Verificar interpolações (`{{variable}}`)
- [ ] Verificar pluralização (se aplicável)

---

## 🎯 Próximos Passos

1. **Traduzir Dashboard** - Métricas, gráficos, cards
2. **Traduzir Campanhas** - CampaignsPage + CampaignWizard
3. **Traduzir Pipeline** - LeadsPage (stages: Prospecção, Qualificação, etc.)
4. **Traduzir Formulários** - Validações e placeholders
5. **Traduzir Modals** - Todos os modais do sistema
6. **Traduzir Mensagens de Erro** - Backend controllers
7. **Formatação de Datas** - Implementar date-fns com locales

---

## 💡 Dicas e Boas Práticas

### ✅ Fazer
- Usar chaves descritivas: `auth.login.title` (não `t1`, `msg2`)
- Agrupar por contexto: `buttons.save`, `forms.email`
- Manter consistência entre idiomas
- Usar interpolação para valores dinâmicos
- Testar em todos os idiomas

### ❌ Evitar
- Hardcoded strings: `<h1>Título</h1>`
- Chaves genéricas: `t('text1')`, `t('msg')`
- Textos muito longos numa única chave (quebrar em parágrafos)
- Misturar idiomas: não traduzir termos técnicos como "Pipeline", "Dashboard"
- Esquecer de traduzir tooltips, placeholders, aria-labels

---

## 📚 Recursos

- [react-i18next Docs](https://react.i18next.com/)
- [i18next Docs](https://www.i18next.com/)
- [date-fns Locales](https://date-fns.org/docs/I18n)

---

## 🔄 Expansão para Novos Idiomas

Para adicionar um novo idioma (ex: Francês):

1. Criar diretórios `locales/fr/` (frontend e backend)
2. Copiar estrutura dos arquivos JSON de outro idioma
3. Traduzir todo o conteúdo
4. Adicionar ao `i18n.js`:
   ```js
   supportedLngs: ['en', 'pt', 'es', 'fr'],
   ```
5. Adicionar ao LanguageSelector.jsx:
   ```js
   { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' }
   ```
6. Atualizar validação no backend (userController.js)

---

**Última atualização:** 2025-01-25
**Versão:** 1.0
**Idioma padrão:** Inglês (en)
**Idiomas suportados:** English, Português, Español
