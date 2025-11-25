# Translation Completion Guide - LeadRaze B2B

## Status: 1 of 6 Components Completed

### ✅ COMPLETED Components

#### 1. AIAgentsPage.jsx
- **Status**: Fully translated
- **Files Updated**:
  - `frontend/src/pages/AIAgentsPage.jsx` - Added useTranslation hook and replaced all hardcoded text
  - `frontend/src/locales/en/aiagents.json` - Updated with all translations
  - `frontend/src/locales/pt/aiagents.json` - Updated with all translations
  - `frontend/src/locales/es/aiagents.json` - Updated with all translations

**Translation Keys Added**:
- `title`, `subtitle`, `newAgent`, `loading`
- `profiles.*` - consultivo, direto, educativo, amigavel
- `features.*` - autoSchedule, intentDetection, productsServices, variablesUsed
- `status.*` - active, inactive
- `messages.*` - All user-facing messages
- `actions.*` - All action buttons

---

### 🔄 IN PROGRESS Components

#### 2. UsersPage.jsx
- **Status**: Translation files created, component needs completion
- **What's Done**:
  - Translation file `en/users.json` created with comprehensive keys
  - `useTranslation` hook added to component
  - Role configuration updated

**To Complete**:
Add these translation calls throughout the component:
```javascript
// Page header
<h1>{t('title')}</h1>
<p>{t('subtitle', { count: filteredUsers.length })}</p>

// Search & Filters
<input placeholder={t('searchPlaceholder')} />
<button>{t('filters')}</button>

// Form fields
<label>{t('form.name')}</label>
<input placeholder={t('form.namePlaceholder')} />
// ... repeat for all form fields

// Table headers
<th>{t('table.user')}</th>
<th>{t('table.profile')}</th>
<th>{t('table.status')}</th>
<th>{t('table.createdAt')}</th>
<th>{t('table.actions')}</th>

// Status badges
{user.is_active ? t('status.active') : t('status.inactive')}

// Action buttons
<button>{t('actions.edit')}</button>
<button>{t('actions.delete')}</button>

// Messages
confirm(t('messages.confirmDelete'))
alert(t('messages.cannotDeleteAdmin'))
```

**PT Translation File** (`pt/users.json`):
```json
{
  "title": "Gestão de Usuários",
  "subtitle": "{{count}} usuário cadastrado",
  "subtitle_plural": "{{count}} usuários cadastrados",
  "newUser": "Novo Usuário",
  "searchPlaceholder": "Buscar por nome ou email...",
  "filters": "Filtros",
  "filterByRole": "Perfil",
  "all": "Todos",
  // ... (complete file based on en version)
}
```

**ES Translation File** (`es/users.json`):
```json
{
  "title": "Gestión de Usuarios",
  "subtitle": "{{count}} usuario registrado",
  "subtitle_plural": "{{count}} usuarios registrados",
  "newUser": "Nuevo Usuario",
  "searchPlaceholder": "Buscar por nombre o email...",
  "filters": "Filtros",
  // ... (complete file based on en version)
}
```

---

#### 3. LinkedInAccountsPage.jsx
- **Status**: Needs translation files and component updates

**Required Translation Keys**:
```json
{
  "title": "Connected Channels",
  "subtitle": "Manage all your connected accounts across different channels",
  "connectChannel": "Connect Channel",
  "loading": "Loading LinkedIn accounts...",
  "stats": {
    "totalAccounts": "Total Accounts",
    "activeAccounts": "Active Accounts",
    "dailyLimitTotal": "Total Daily Limit",
    "sentToday": "Sent Today"
  },
  "accountTypes": {
    "salesNavigator": "Sales Navigator",
    "recruiter": "Recruiter",
    "premium": "Premium",
    "free": "Free"
  },
  "health": {
    "healthy": "Healthy",
    "warning": "Warning",
    "critical": "Critical"
  },
  "table": {
    "account": "Account",
    "dailyLimit": "Daily Limit",
    "sentToday": "Sent Today",
    "usage": "Daily Usage",
    "organizations": "Connected Organizations",
    "connectedOn": "Connected",
    "unipileId": "Unipile ID"
  },
  "actions": {
    "limits": "Limits",
    "refresh": "Refresh account data",
    "remove": "Remove account"
  },
  "status": {
    "active": "Active",
    "inactive": "Inactive"
  },
  "messages": {
    "noAccounts": "No connected channels",
    "noAccountsDescription": "Connect your first LinkedIn account or other channel to start",
    "connectFirst": "Connect first channel",
    "refreshSuccess": "Account updated successfully",
    "refreshError": "Error updating account. Try again."
  }
}
```

---

#### 4. ConversationsPage.jsx
- **Status**: Needs comprehensive translation

**Key Translation Areas**:
- Conversation filters (mine, all, unassigned, closed)
- Search functionality
- Advanced filters panel
- Filter pills/tags
- No conversations message

**Required Translation Keys**:
```json
{
  "filters": {
    "mine": "My Conversations",
    "all": "All",
    "unassigned": "Unassigned",
    "closed": "Closed",
    "showFilters": "Show Filters",
    "hideFilters": "Hide Filters",
    "clearAll": "Clear All Filters"
  },
  "advancedFilters": {
    "status": "Status",
    "campaigns": "Campaign",
    "tags": "Tags",
    "period": "Period",
    "mode": "Mode"
  },
  "statuses": {
    "open": "Open",
    "ai_active": "AI Active",
    "manual": "Manual",
    "closed": "Closed"
  },
  "modes": {
    "all": "All",
    "ai": "AI",
    "manual": "Manual"
  },
  "periods": {
    "all": "All Time",
    "today": "Today",
    "last_7_days": "Last 7 Days",
    "last_30_days": "Last 30 Days",
    "this_month": "This Month",
    "last_month": "Last Month"
  },
  "messages": {
    "confirmDelete": "Are you sure you want to delete this conversation?"
  }
}
```

---

#### 5. AnalyticsPage.jsx
- **Status**: Needs translation

**Required Translation Keys**:
```json
{
  "title": "Analytics & Reports",
  "subtitle": "Detailed performance analysis",
  "loading": "Loading analytics...",
  "periods": {
    "7days": "7 days",
    "30days": "30 days",
    "90days": "90 days"
  },
  "metrics": {
    "totalLeads": "Total Leads",
    "acceptedInvites": "Accepted Invites",
    "qualifiedLeads": "Qualified Leads",
    "activeConversations": "Active Conversations"
  },
  "charts": {
    "conversionRates": "Conversion Rates",
    "topCampaigns": "Top Campaigns",
    "linkedinPerformance": "LinkedIn Account Performance",
    "aiPerformance": "AI Agents Performance",
    "invitationAcceptance": "Invitation Acceptance",
    "qualificationRate": "Qualification Rate",
    "aiResponseRate": "AI Response Rate",
    "avgResponseTime": "Average Response Time",
    "aiConversationsToday": "AI Conversations Today"
  },
  "table": {
    "account": "Account",
    "campaigns": "Campaigns",
    "sent": "Sent",
    "accepted": "Accepted",
    "rate": "Rate",
    "dailyLimit": "Daily Limit",
    "conversations": "Conversations",
    "messages": "Messages",
    "qualified": "Qualified"
  }
}
```

---

#### 6. SearchPage.jsx
- **Status**: Needs translation

**Required Translation Keys**:
```json
{
  "title": "Search & Prospecting",
  "subtitle": "Find and collect profiles for your campaigns",
  "search": {
    "placeholder": "Search keywords...",
    "button": "Search",
    "loadMore": "Load More Results",
    "loading": "Searching...",
    "loadingMore": "Loading more results..."
  },
  "filters": {
    "account": "LinkedIn Account",
    "selectAccount": "Select an account",
    "api": "Search API",
    "category": "Category",
    "limit": "Results per page",
    "location": "Location",
    "industries": "Industries",
    "jobTitles": "Job Titles",
    "companies": "Companies"
  },
  "categories": {
    "people": "People",
    "companies": "Companies"
  },
  "results": {
    "found": "{{count}} profiles found",
    "selected": "{{count}} selected",
    "noResults": "No profiles found",
    "tryAdjusting": "Try adjusting your search filters"
  },
  "bulkCollection": {
    "title": "Bulk Collection",
    "subtitle": "Collect hundreds of profiles automatically",
    "targetCount": "How many profiles do you want to collect?",
    "targetCountHelp": "Minimum: 10 | Maximum: 1,000 profiles",
    "selectCampaign": "Save profiles to which campaign?",
    "selectCampaignPlaceholder": "Select a campaign...",
    "createNewCampaign": "+ Create new campaign",
    "campaignNamePlaceholder": "New campaign name...",
    "create": "Create",
    "creating": "Creating...",
    "cancel": "Cancel",
    "start": "Start Collection",
    "howItWorks": "How it works:",
    "step1": "• Collection will be done in background",
    "step2": "• You will receive progress notifications",
    "step3": "• Profiles will be automatically saved to campaign",
    "step4": "• May take a few minutes depending on quantity",
    "success": "Bulk collection started! You will receive a notification when complete.",
    "error": "Error starting collection"
  },
  "messages": {
    "selectAccount": "Select a LinkedIn account",
    "campaignCreated": "Campaign created successfully!",
    "campaignRequired": "Select a campaign"
  }
}
```

---

## Implementation Steps for Each Component

### For Each Remaining Component:

1. **Update Translation Files** (EN/PT/ES)
   - Create comprehensive translation keys
   - Ensure all user-facing text is covered
   - Use consistent naming conventions

2. **Update Component File**
   - Add: `import { useTranslation } from 'react-i18next';`
   - Add: `const { t } = useTranslation(['namespace', 'common']);`
   - Replace all hardcoded text with `t('key')` calls
   - Use interpolation for dynamic values: `t('key', { count, name })`

3. **Test Translations**
   - Switch between languages (EN/PT/ES)
   - Verify all text changes correctly
   - Check pluralization works
   - Ensure dynamic values display properly

---

## Quick Reference - Translation Patterns

### Simple Text
```javascript
// Before
<h1>Agentes de IA</h1>

// After
<h1>{t('title')}</h1>
```

### With Variables
```javascript
// Before
<p>{users.length} usuários cadastrados</p>

// After
<p>{t('subtitle', { count: users.length })}</p>
```

### Conditional Text
```javascript
// Before
{isActive ? 'Ativo' : 'Inativo'}

// After
{isActive ? t('status.active') : t('status.inactive')}
```

### Confirmation Dialogs
```javascript
// Before
if (confirm('Tem certeza que deseja excluir?'))

// After
if (confirm(t('messages.confirmDelete')))
```

### Alert Messages
```javascript
// Before
alert('Erro ao salvar')

// After
alert(t('messages.errorSaving'))
```

---

## Translation File Structure

Each component should have 3 translation files:
- `frontend/src/locales/en/[component].json`
- `frontend/src/locales/pt/[component].json`
- `frontend/src/locales/es/[component].json`

Keys should be organized by functionality:
- `title`, `subtitle` - Page headers
- `form.*` - Form labels and placeholders
- `table.*` - Table headers and cells
- `actions.*` - Button labels
- `status.*` - Status badges
- `messages.*` - User feedback messages
- `filters.*` - Filter options

---

## Next Steps

1. Complete UsersPage.jsx translation (50% done)
2. Create translation files for LinkedInAccountsPage.jsx
3. Create translation files for ConversationsPage.jsx
4. Create translation files for AnalyticsPage.jsx
5. Create translation files for SearchPage.jsx
6. Update each component with useTranslation hook
7. Test all translations in all 3 languages

**Estimated Time**: 2-3 hours for remaining 5 components

---

## Testing Checklist

For each translated component:
- [ ] Switch to English - verify all text displays
- [ ] Switch to Portuguese - verify all text displays
- [ ] Switch to Spanish - verify all text displays
- [ ] Test pluralization (items with counts)
- [ ] Test dynamic values (names, numbers, etc.)
- [ ] Test all button labels
- [ ] Test all form fields
- [ ] Test all error messages
- [ ] Test all confirmation dialogs
- [ ] Test empty states
- [ ] Test loading states

---

*This guide provides a complete roadmap for finishing the translation of all 6 components.*
