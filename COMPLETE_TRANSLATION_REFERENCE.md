# 🌍 Referência Completa de Tradução - LeadRaze B2B

## ✅ STATUS ATUAL

### Componentes Já Traduzidos
- ✅ LoginPage.jsx
- ✅ Layout.jsx (navegação completa)
- ✅ LanguageSelector.jsx
- ✅ Dashboard.jsx (parcialmente iniciado)

### Arquivos JSON Prontos (EN/PT/ES)
- ✅ common.json (~40 chaves)
- ✅ auth.json (~30 chaves)
- ✅ navigation.json (~30 chaves)
- ✅ dashboard.json (~20 chaves)
- ✅ campaigns.json (~50 chaves)
- ✅ leads.json (~45 chaves)
- ✅ contacts.json (~40 chaves)

**Total: ~255 chaves × 3 idiomas = 765 traduções prontas!**

---

## ⚡ TEMPLATE RÁPIDO DE TRADUÇÃO

### Para QUALQUER Componente

```jsx
// 1. Adicionar no topo (após outros imports)
import { useTranslation } from 'react-i18next';

// 2. Dentro do componente (primeira linha)
const { t } = useTranslation('namespace'); // common, campaigns, leads, contacts, etc.

// 3. Substituir textos
// ANTES:
<h1>Título Hardcoded</h1>
<button>Criar Novo</button>
<p>Nenhum item encontrado</p>

// DEPOIS:
<h1>{t('title')}</h1>
<button>{t('actions.create')}</button>
<p>{t('messages.noItems')}</p>
```

---

##  TRADUÇÃO POR COMPONENTE - COPY & PASTE

### 1. Dashboard.jsx
```jsx
// Adicionar no import:
import { useTranslation } from 'react-i18next';

// Adicionar no componente:
const { t } = useTranslation(['dashboard', 'common']);

// Substituir textos principais:
"Carregando dashboard..." → {t('common:messages.loading')}
"Total de Leads" → {t('metrics.totalLeads')}
"Taxa de Conversão" → {t('metrics.conversionRate')}
"Campanhas Ativas" → {t('metrics.activeCampaigns')}
"Visão Geral" → {t('overview')}
"Atividade Recente" → {t('recentActivity.title')}
```

### 2. CampaignsPage.jsx
```jsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation(['campaigns', 'common']);

// Textos principais:
"Campanhas" → {t('title')}
"Nova Campanha" → {t('newCampaign')}
"Nenhuma campanha" → {t('noCampaigns')}
"Criar" → {t('common:buttons.create')}
"Editar" → {t('common:buttons.edit')}
"Excluir" → {t('common:buttons.delete')}
"Ativa" → {t('status.active')}
"Pausada" → {t('status.paused')}
"Rascunho" → {t('status.draft')}
"Iniciar Campanha" → {t('actions.start')}
"Pausar Campanha" → {t('actions.pause')}
```

### 3. LeadsPage.jsx
```jsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation(['leads', 'common']);

// Textos principais:
"Pipeline" → {t('title')}
"Todos os Leads" → {t('allLeads')}
"Novo Lead" → {t('newLead')}
"Prospecção" → {t('stages.leads')}
"Qualificação" → {t('stages.qualifying')}
"Em Andamento" → {t('stages.accepted')}
"Ganho" → {t('stages.qualified')}
"Perdido" → {t('stages.discarded')}
"Mover para" → {t('actions.moveTo')}
"Atribuir a" → {t('actions.assignTo')}
```

### 4. ContactsPage.jsx
```jsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation(['contacts', 'common']);

// Textos principais:
"Contatos" → {t('title')}
"Novo Contato" → {t('newContact')}
"Importar Contatos" → {t('importContacts')}
"Exportar Contatos" → {t('exportContacts')}
"Nome" → {t('form.firstName')}
"Email" → {t('form.email')}
"Telefone" → {t('form.phone')}
"Empresa" → {t('form.company')}
```

### 5. ContactListsPage.jsx
```jsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation(['contacts', 'common']);

// Textos principais:
"Listas de Contatos" → {t('lists.title')}
"Nova Lista" → {t('lists.newList')}
"Criar Lista" → {t('lists.createList')}
"Editar Lista" → {t('lists.editList')}
"Adicionar à Lista" → {t('lists.addToList')}
```

### 6. ConversationsPage.jsx
```jsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation(['common', 'navigation']);

// Textos principais:
"Conversas" → {t('navigation:menu.conversations')}
"Nova Conversa" → {t('newConversation')}
"Mensagem" → {t('message')}
"Enviar" → {t('common:buttons.send')}
```

### 7. AIAgentsPage.jsx
```jsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation(['common', 'navigation']);

// Textos principais:
"Agentes de IA" → {t('navigation:menu.aiAgents')}
"Todos os Agentes" → {t('navigation:menu.allAgents')}
"Novo Agente" → {t('newAgent')}
```

### 8. SettingsPage.jsx
```jsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation(['common', 'navigation']);

// Textos principais:
"Configurações" → {t('navigation:menu.settings')}
"Perfil" → {t('navigation:userMenu.profile')}
"Salvar" → {t('common:buttons.save')}
"Cancelar" → {t('common:buttons.cancel')}
```

---

## 📋 COMPONENTES RESTANTES

### Alta Prioridade (traduzir primeiro)
1. ⏳ CampaignsPage.jsx
2. ⏳ LeadsPage.jsx
3. ⏳ ContactsPage.jsx
4. ⏳ ContactListsPage.jsx
5. ⏳ ConversationsPage.jsx
6. ⏳ Dashboard.jsx (completar)

### Média Prioridade
7. ⏳ AIAgentsPage.jsx
8. ⏳ AgentsPage.jsx
9. ⏳ SettingsPage.jsx
10. ⏳ LinkedInAccountsPage.jsx
11. ⏳ GoogleMapsAgentsPage.jsx
12. ⏳ GoogleMapsSearchPage.jsx
13. ⏳ SearchPage.jsx
14. ⏳ ActivationCampaignsPage.jsx
15. ⏳ ActivationAgentsPage.jsx

### Baixa Prioridade (admin/avançado)
16. ⏳ UsersPage.jsx
17. ⏳ PermissionsPage.jsx
18. ⏳ SectorsPage.jsx
19. ⏳ AnalyticsPage.jsx
20. ⏳ InsightsPage.jsx
21. ⏳ AuthCallbackPage.jsx
22. ⏳ AuthErrorPage.jsx

---

## 🎯 CHAVES MAIS USADAS (Atalhos)

### Botões
```jsx
{t('common:buttons.save')}      // Salvar / Save / Guardar
{t('common:buttons.cancel')}    // Cancelar / Cancel / Cancelar
{t('common:buttons.delete')}    // Excluir / Delete / Eliminar
{t('common:buttons.create')}    // Criar / Create / Crear
{t('common:buttons.edit')}      // Editar / Edit / Editar
{t('common:buttons.close')}     // Fechar / Close / Cerrar
{t('common:buttons.confirm')}   // Confirmar / Confirm / Confirmar
{t('common:buttons.next')}      // Próximo / Next / Siguiente
{t('common:buttons.back')}      // Voltar / Back / Volver
{t('common:buttons.finish')}    // Finalizar / Finish / Finalizar
{t('common:buttons.search')}    // Pesquisar / Search / Buscar
{t('common:buttons.filter')}    // Filtrar / Filter / Filtrar
{t('common:buttons.refresh')}   // Atualizar / Refresh / Actualizar
```

### Status
```jsx
{t('common:status.active')}     // Ativo / Active / Activo
{t('common:status.inactive')}   // Inativo / Inactive / Inactivo
{t('common:status.pending')}    // Pendente / Pending / Pendiente
{t('common:status.completed')}  // Concluído / Completed / Completado
{t('common:status.failed')}     // Falhou / Failed / Fallido
{t('common:status.paused')}     // Pausado / Paused / Pausado
{t('common:status.draft')}      // Rascunho / Draft / Borrador
```

### Mensagens
```jsx
{t('common:messages.loading')}       // Carregando... / Loading... / Cargando...
{t('common:messages.success')}       // Sucesso / Success / Éxito
{t('common:messages.error')}         // Erro / Error / Error
{t('common:messages.noData')}        // Sem dados / No data / Sin datos
{t('common:messages.confirmDelete')} // Confirmar exclusão / Confirm delete / Confirmar eliminación
```

---

## 🔧 PROBLEMAS COMUNS E SOLUÇÕES

### Problema 1: "Missing translation key"
```
Console: Missing translation: en.campaigns.myKey
```
**Solução:** Adicionar a chave em todos os 3 idiomas (EN/PT/ES)

### Problema 2: Texto não traduz
**Checklist:**
- [ ] Adicionou `import { useTranslation } from 'react-i18next';`?
- [ ] Adicionou `const { t } = useTranslation('namespace');`?
- [ ] Usou `{t('key')}` em vez de string hardcoded?
- [ ] A chave existe no arquivo JSON?
- [ ] O namespace está correto?

### Problema 3: Namespace não encontrado
**Solução:** Verificar se o namespace foi adicionado no `i18n.js`:
- Import do JSON ✓
- Adicionado em `resources` ✓
- Adicionado em `ns: [...]` ✓

---

## 📊 PROGRESSO ESTIMADO

### Por Componente
- LoginPage: ✅ 100%
- Layout: ✅ 100%
- LanguageSelector: ✅ 100%
- Dashboard: 🔄 30%
- CampaignsPage: ⏳ 0%
- LeadsPage: ⏳ 0%
- ContactsPage: ⏳ 0%
- ContactListsPage: ⏳ 0%
- ConversationsPage: ⏳ 0%
- AIAgentsPage: ⏳ 0%
- SettingsPage: ⏳ 0%
- Demais (16): ⏳ 0%

**Total: 3/23 componentes = 13% completo**

---

## 🚀 WORKFLOW SUGERIDO

### Opção 1: Traduzir 1 por Dia (23 dias)
- Dia 1: CampaignsPage
- Dia 2: LeadsPage
- Dia 3: ContactsPage
- ...

### Opção 2: Traduzir em Blocos (1 semana)
- Segunda: CampaignsPage + LeadsPage
- Terça: ContactsPage + ContactListsPage
- Quarta: ConversationsPage + Dashboard
- Quinta: AIAgentsPage + SettingsPage
- Sexta: GoogleMaps + Search + Activation
- Sábado: Admin pages (Users, Permissions, Sectors)
- Domingo: Revisão e testes

### Opção 3: Sprint de 2 Dias (Recomendado)
- **Dia 1 Manhã:** CampaignsPage, LeadsPage, ContactsPage
- **Dia 1 Tarde:** ContactListsPage, ConversationsPage, Dashboard
- **Dia 2 Manhã:** AIAgentsPage, SettingsPage, LinkedInAccounts
- **Dia 2 Tarde:** Demais páginas + testes

---

## 🎯 CHECKLIST FINAL

### Por Componente
- [ ] Import `useTranslation`
- [ ] Adicionar hook `const { t } = useTranslation('namespace')`
- [ ] Substituir TODOS os textos hardcoded
- [ ] Testar em EN
- [ ] Testar em PT
- [ ] Testar em ES
- [ ] Commit

### Global
- [ ] Todos os componentes traduzidos
- [ ] Todas as páginas testadas
- [ ] Documentação atualizada
- [ ] README com instruções
- [ ] Deploy

---

## 💾 GIT COMMITS SUGERIDOS

```bash
# Por componente
git commit -m "feat(i18n): translate CampaignsPage to EN/PT/ES"
git commit -m "feat(i18n): translate LeadsPage to EN/PT/ES"
git commit -m "feat(i18n): translate ContactsPage to EN/PT/ES"

# Por grupo
git commit -m "feat(i18n): translate main pages (Campaigns, Leads, Contacts)"
git commit -m "feat(i18n): translate CRM pages (ContactLists, Conversations)"
git commit -m "feat(i18n): translate admin pages (Users, Permissions, Sectors)"

# Final
git commit -m "feat(i18n): complete multilingual system - 100% translated"
```

---

## 📚 RECURSOS

### Documentação Completa
- **I18N_GUIDE.md** - Guia técnico detalhado
- **TRANSLATION_QUICKSTART.md** - Guia rápido de tradução
- **Este arquivo** - Referência completa

### Arquivos de Tradução
- `frontend/src/locales/en/*.json`
- `frontend/src/locales/pt/*.json`
- `frontend/src/locales/es/*.json`

### Exemplos Práticos
- `LoginPage.jsx` - Exemplo completo
- `Layout.jsx` - Navegação traduzida
- `LanguageSelector.jsx` - Componente de troca

---

**Última atualização:** 2025-01-25
**Versão:** 2.0
**Status:** Infraestrutura 100% + Traduções base 100% + Componentes iniciais traduzidos
**Próximo passo:** Traduzir componentes restantes usando este guia

---

🎯 **Tudo pronto para traduzir rapidamente! Use este documento como referência.**
