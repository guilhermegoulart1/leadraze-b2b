# 🚀 Guia Rápido de Tradução - LeadRaze B2B

## ⚡ TL;DR - Como Traduzir um Componente em 3 Passos

### 1. Adicionar o Hook
```jsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation('namespace'); // dashboard, campaigns, leads, contacts
  // ...
}
```

### 2. Substituir Strings Hardcoded
```jsx
// ❌ Antes
<h1>Campanhas Ativas</h1>
<button>Criar Nova</button>

// ✅ Depois
<h1>{t('title')}</h1>
<button>{t('actions.create')}</button>
```

### 3. Verificar se a Chave Existe nos JSONs
- Checar em `locales/en/namespace.json`
- Se não existir, adicionar em EN/PT/ES

---

## 📋 Checklist por Componente

Para cada componente `.jsx` que você for traduzir:

- [ ] Import `useTranslation`
- [ ] Adicionar `const { t } = useTranslation('namespace')`
- [ ] Substituir TODOS os textos hardcoded
- [ ] Verificar botões, labels, placeholders
- [ ] Verificar tooltips (`title=`)
- [ ] Verificar mensagens de erro
- [ ] Testar em PT/EN/ES
- [ ] Commit!

---

## 🎯 Namespaces Disponíveis

| Namespace | Uso | Arquivo |
|-----------|-----|---------|
| `common` | Botões, status, mensagens comuns | `common.json` |
| `auth` | Login, registro | `auth.json` |
| `navigation` | Menu, navegação | `navigation.json` |
| `dashboard` | Dashboard | `dashboard.json` |
| `campaigns` | Campanhas | `campaigns.json` |
| `leads` | Pipeline de leads | `leads.json` |
| `contacts` | Contatos | `contacts.json` |

---

## 📝 Templates de Tradução

### Componente Simples
```jsx
import React from 'react';
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation('common');

  return (
    <div>
      <h1>{t('title')}</h1>
      <button>{t('buttons.save')}</button>
    </div>
  );
}
```

### Componente com Múltiplos Namespaces
```jsx
const { t } = useTranslation(['campaigns', 'common']);

<h1>{t('campaigns:title')}</h1>
<button>{t('common:buttons.save')}</button>
```

### Com Interpolação
```jsx
<p>{t('welcome', { name: user.name })}</p>
// JSON: "welcome": "Welcome, {{name}}!"
```

### Com Contagem/Plurais
```jsx
<p>{t('itemsCount', { count: 5 })}</p>
// JSON: "itemsCount": "{{count}} items"
```

---

## 🔍 Como Encontrar Strings Hardcoded

### Busca Manual
1. Abrir componente `.jsx`
2. Procurar por strings entre aspas dentro do JSX
3. Especialmente em:
   - `<h1>`, `<h2>`, `<p>`, `<span>`, `<button>`
   - `placeholder=`
   - `title=`
   - `aria-label=`
   - `alert()`, `confirm()`

### Padrões Comuns
```jsx
// ❌ Hardcoded
<button>Salvar</button>
<input placeholder="Digite seu nome" />
<div title="Clique aqui" />
{error && <p>Erro ao salvar</p>}

// ✅ Traduzido
<button>{t('buttons.save')}</button>
<input placeholder={t('form.namePlaceholder')} />
<div title={t('tooltips.clickHere')} />
{error && <p>{t('errors.saveFailed')}</p>}
```

---

## 🎨 Exemplo Completo: Antes → Depois

### ANTES (Hardcoded)
```jsx
function CampaignsPage() {
  return (
    <div>
      <h1>Minhas Campanhas</h1>
      <button>Nova Campanha</button>
      <p>Você tem 5 campanhas ativas</p>
      {campaigns.length === 0 && (
        <div>
          <p>Nenhuma campanha criada</p>
          <button>Criar Primeira Campanha</button>
        </div>
      )}
    </div>
  );
}
```

### DEPOIS (Traduzido)
```jsx
import { useTranslation } from 'react-i18next';

function CampaignsPage() {
  const { t } = useTranslation('campaigns');

  return (
    <div>
      <h1>{t('title')}</h1>
      <button>{t('newCampaign')}</button>
      <p>{t('activeCampaigns', { count: 5 })}</p>
      {campaigns.length === 0 && (
        <div>
          <p>{t('noCampaigns')}</p>
          <button>{t('createFirst')}</button>
        </div>
      )}
    </div>
  );
}
```

---

## 📦 Componentes Prioritários para Traduzir

### ✅ Já Traduzidos
- LoginPage.jsx
- Layout.jsx

### ⏳ Alta Prioridade
1. **Dashboard.jsx** - Página principal
2. **CampaignsPage.jsx** - Lista de campanhas
3. **LeadsPage.jsx** - Pipeline de leads
4. **ContactsPage.jsx** - Lista de contatos
5. **CampaignWizard.jsx** - Criação de campanha
6. **ContactListsPage.jsx** - Listas de contatos

### 📋 Média Prioridade
7. ConversationsPage.jsx
8. AIAgentsPage.jsx
9. SettingsPage.jsx
10. ProfilePage.jsx
11. LinkedInAccountsPage.jsx
12. GoogleMapsAgentsPage.jsx

### 🔽 Baixa Prioridade
- Modais menores
- Componentes de chart/gráfico (só labels)
- Páginas admin (UsersPage, etc.)

---

## 🛠️ Ferramentas Úteis

### VS Code Extensions Recomendadas
- **i18n Ally** - Visualizar traduções inline
- **Better Comments** - Marcar TODOs

### Busca Rápida (VS Code)
```regex
Buscar: >[^<{]*[a-zA-Z]{2,}[^<{]*<
```
Isso encontra textos hardcoded em JSX (não 100% preciso, mas ajuda)

---

## 🎯 Dicas de Produtividade

### 1. Traduzir por Ordem de Prioridade
Não tente traduzir tudo de uma vez. Comece pelos componentes mais usados.

### 2. Reusar Chaves do `common.json`
Antes de criar nova chave, checar se já existe em `common.json`:
- `buttons.save`, `buttons.cancel`, `buttons.delete`
- `status.active`, `status.pending`
- `messages.success`, `messages.error`

### 3. Copiar Estrutura Existente
Use LoginPage.jsx e Layout.jsx como referência.

### 4. Testar Incrementalmente
Traduza 1-2 componentes e teste antes de continuar.

### 5. Git Commits Pequenos
Commitar a cada componente traduzido facilita rollback se necessário.

---

## 🐛 Troubleshooting

### Erro: "Missing translation key"
```
// Console: Missing translation: en.campaigns.nonExistent
```
**Solução:** Adicionar a chave em `locales/en/campaigns.json`

### Texto não muda ao trocar idioma
**Possíveis causas:**
1. Esqueceu de usar `t()` → Verificar se está usando `{t('key')}`
2. Namespace errado → Verificar se usou o namespace correto
3. Chave não existe → Verificar se a chave existe no JSON

### Namespace não encontrado
```
// Erro: Namespace 'myNamespace' was not added to the translations
```
**Solução:** Adicionar namespace no `i18n.js`:
1. Import dos JSONs
2. Adicionar em `resources`
3. Adicionar em `ns: [...]`

---

## 📊 Progresso Atual

### ✅ Infraestrutura (100%)
- i18n configurado
- Banco de dados atualizado
- API endpoint criado
- LanguageSelector funcionando

### ✅ Traduções Base (100%)
- common.json (EN/PT/ES)
- auth.json (EN/PT/ES)
- navigation.json (EN/PT/ES)
- dashboard.json (EN/PT/ES)
- campaigns.json (EN/PT/ES)
- leads.json (EN/PT/ES)
- contacts.json (EN/PT/ES)

### ✅ Componentes Traduzidos (2/44)
- ✅ LoginPage.jsx
- ✅ Layout.jsx
- ⏳ Dashboard.jsx
- ⏳ CampaignsPage.jsx
- ⏳ LeadsPage.jsx
- ⏳ ... (42 componentes restantes)

---

## 🎬 Vamos Começar!

### Próximo Componente Sugerido: `CampaignsPage.jsx`

1. Abrir `frontend/src/pages/CampaignsPage.jsx`
2. Adicionar `import { useTranslation } from 'react-i18next';`
3. Adicionar `const { t } = useTranslation('campaigns');`
4. Substituir textos hardcoded por `t('key')`
5. Testar em 3 idiomas
6. Commit!

---

**Boa sorte! 🚀**
