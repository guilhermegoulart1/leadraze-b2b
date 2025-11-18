# LeadRaze B2B - Changelog de Atualizações

## Data: 16/11/2025

### Resumo das Alterações

Este documento descreve todas as melhorias implementadas no sistema LeadRaze B2B.

---

## 1. Correção de Fotos do LinkedIn via Unipile

### Problema Identificado
As fotos dos perfis do LinkedIn não estavam sendo exibidas corretamente ao fazer buscas via Unipile.

### Solução Implementada
- **Backend** ([profileController.js:397-406](backend/src/controllers/profileController.js#L397-L406)):
  - Adicionado mapeamento de múltiplos campos possíveis de foto da API Unipile:
    - `profile_picture`
    - `profile_picture_url`
    - `profile_picture_url_large`
    - `picture`
    - `photo`
    - `image`
    - `avatar`
    - `photoUrl`

- **Frontend** ([SearchPage.jsx:350-359](frontend/src/pages/SearchPage.jsx#L350-L359)):
  - Atualizado componente ProfileCard para verificar todos os campos de foto
  - Implementado fallback com iniciais do nome em caso de falha no carregamento

### Resultado
As fotos dos perfis agora são exibidas corretamente, independente do campo retornado pela API Unipile.

---

## 2. Melhoria no Espaçamento da Interface

### Problema Identificado
Os cards de perfil na página de busca ocupavam muito espaço vertical, dificultando a visualização de múltiplos resultados.

### Solução Implementada
- **Redução de tamanho dos cards**:
  - Avatar reduzido de 80px (w-20 h-20) para 56px (w-14 h-14)
  - Padding do card reduzido de 24px (p-6) para 12px (p-3)
  - Textos otimizados para usar menos espaço vertical
  - Informações secundárias organizadas em linha única

- **Layout mais compacto**:
  - Empresa e localização na mesma linha
  - Ícone do LinkedIn como botão pequeno
  - Checkbox de seleção alinhado à direita

### Resultado
Agora é possível visualizar aproximadamente 2x mais perfis na mesma tela, melhorando significativamente a experiência de busca.

---

## 3. Sistema de Pipeline CRM Completo

### Modelo de Banco de Dados

#### Tabela `campaigns` - Novas Colunas:
```sql
- description TEXT
- leads_scheduled INTEGER DEFAULT 0
- leads_won INTEGER DEFAULT 0
- leads_lost INTEGER DEFAULT 0
```

#### Tabela `leads` - Novas Colunas:
```sql
- scheduled_at TIMESTAMP      -- Data de agendamento
- won_at TIMESTAMP            -- Data de conversão (ganho)
- lost_at TIMESTAMP           -- Data de perda
- lost_reason TEXT            -- Motivo da perda
- notes TEXT                  -- Notas adicionais
- summary TEXT                -- Resumo do perfil
- industry VARCHAR(255)       -- Setor/indústria
- connections INTEGER         -- Número de conexões no LinkedIn
```

#### Status do Pipeline (Constraint Atualizada):
```sql
'lead'         -- LEAD (novo lead capturado)
'invite_sent'  -- CONVITE ENVIADO (convite enviado no LinkedIn)
'qualifying'   -- QUALIFICAÇÃO (em processo de qualificação)
'scheduled'    -- AGENDAMENTO (reunião/demo agendada)
'won'          -- GANHO (convertido em cliente)
'lost'         -- PERDIDO (lead descartado/perdido)
```

### Scripts Criados

1. **[schema.sql](backend/database/schema.sql)** - Schema completo do banco
2. **[update-schema.js](backend/scripts/update-schema.js)** - Script de atualização do schema
3. **[seed.js](backend/scripts/seed.js)** - Script de inserção de dados de exemplo

---

## 4. Interface Kanban para Pipeline de Vendas

### Componente Completamente Redesenhado
- **Arquivo**: [LeadsPage.jsx](frontend/src/pages/LeadsPage.jsx)

### Características:

#### 📊 Dashboard de Métricas
- Cards com contador de leads por estágio
- Ícones específicos para cada estágio
- Cores diferenciadas para identificação visual

#### 🎯 Board Kanban
Colunas organizadas por estágio:
1. **LEAD** (cinza) - Novos leads capturados
2. **CONVITE ENVIADO** (azul) - Convites enviados no LinkedIn
3. **QUALIFICAÇÃO** (amarelo) - Em processo de qualificação
4. **AGENDAMENTO** (roxo) - Reuniões/demos agendadas
5. **GANHO** (verde) - Convertidos em clientes
6. **PERDIDO** (vermelho) - Leads descartados

#### 💳 Cards de Leads
Cada card contém:
- Foto do perfil (ou avatar com iniciais)
- Nome do lead
- Cargo
- Empresa
- Localização
- Score de qualificação (barra de progresso)
- Data de criação
- Menu de ações (ao passar o mouse)

#### 🔍 Funcionalidades
- Busca por nome ou empresa
- Scroll horizontal para navegar entre colunas
- Scroll vertical dentro de cada coluna
- Estilo de scrollbar personalizado
- Responsivo para mobile e desktop

---

## 5. Dados de Exemplo no Banco

### Dados Inseridos
- **1 Usuário**: demo@leadraze.com (senha: demo123)
- **1 Campanha**: "Prospecção Q4 2024"
- **15 Leads** distribuídos nos diferentes estágios:
  - 3 em LEAD
  - 3 em CONVITE ENVIADO
  - 3 em QUALIFICAÇÃO
  - 2 em AGENDAMENTO
  - 2 em GANHO
  - 2 em PERDIDO

### Como Popular o Banco
```bash
cd backend
node scripts/update-schema.js  # Atualiza o schema
node scripts/seed.js           # Insere dados de exemplo
```

---

## Instruções de Teste

### 1. Atualizar o Banco de Dados
```bash
cd backend
npm install bcrypt  # Se ainda não instalado
node scripts/update-schema.js
node scripts/seed.js
```

### 2. Iniciar o Backend
```bash
cd backend
npm run dev
```

### 3. Iniciar o Frontend
```bash
cd frontend
npm run dev
```

### 4. Acessar o Sistema
- URL: http://localhost:5173
- Email: demo@leadraze.com
- Senha: demo123

### 5. Testar as Funcionalidades

#### Busca de Leads:
1. Vá para a página "Buscar Perfis"
2. Selecione uma conta LinkedIn conectada
3. Use os filtros de busca
4. Observe os cards compactos com fotos

#### Pipeline CRM:
1. Vá para a página "Leads" ou "Pipeline"
2. Visualize o board Kanban com os 6 estágios
3. Veja os 15 leads de exemplo distribuídos
4. Use a busca para filtrar leads
5. Role horizontalmente para ver todos os estágios

---

## Arquivos Modificados

### Backend
- ✅ [backend/src/controllers/profileController.js](backend/src/controllers/profileController.js)
- ✅ [backend/database/schema.sql](backend/database/schema.sql) (novo)
- ✅ [backend/scripts/update-schema.js](backend/scripts/update-schema.js) (novo)
- ✅ [backend/scripts/seed.js](backend/scripts/seed.js) (novo)

### Frontend
- ✅ [frontend/src/pages/SearchPage.jsx](frontend/src/pages/SearchPage.jsx)
- ✅ [frontend/src/pages/LeadsPage.jsx](frontend/src/pages/LeadsPage.jsx)

---

## Próximos Passos Sugeridos

### Funcionalidades Adicionais
1. **Drag & Drop no Kanban**
   - Permitir arrastar leads entre colunas
   - Atualizar status automaticamente

2. **Modal de Detalhes do Lead**
   - Exibir informações completas ao clicar no card
   - Adicionar notas e histórico de interações
   - Permitir edição de campos

3. **Automações**
   - Mover automaticamente para "CONVITE ENVIADO" ao enviar convite
   - Mover para "QUALIFICAÇÃO" quando aceitar convite
   - Notificações de mudanças de estágio

4. **Relatórios e Analytics**
   - Taxa de conversão por estágio
   - Tempo médio em cada estágio
   - Gráficos de funil de vendas
   - Exportação de relatórios

5. **Integração com Calendário**
   - Sincronizar agendamentos com Google Calendar
   - Lembretes automáticos de follow-up
   - Visualização de agenda no dashboard

---

## Observações Técnicas

### Performance
- Índices adicionados para otimizar buscas por texto (summary)
- Constraint checks para garantir integridade dos dados
- Triggers automáticos para atualizar updated_at

### Segurança
- Validação de status nos constraints do banco
- Separação de dados por usuário (user_id)
- Queries otimizadas para evitar N+1

### Compatibilidade
- PostgreSQL 12+
- React 18+
- Node.js 16+

---

## Suporte

Para dúvidas ou problemas:
1. Verifique os logs do backend (console)
2. Verifique os logs do frontend (DevTools)
3. Confirme que o banco está atualizado com update-schema.js
4. Confirme que os dados de exemplo foram inseridos com seed.js

---

**Desenvolvido com Claude Code** 🤖
