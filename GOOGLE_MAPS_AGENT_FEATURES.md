# 🚀 Google Maps Agent - Documentação Completa de Funcionalidades

## 📋 Índice
1. [Visão Geral](#visão-geral)
2. [Funcionalidades Implementadas](#funcionalidades-implementadas)
3. [Modo CRM vs Modo Lista](#modo-crm-vs-modo-lista)
4. [Múltiplas Localizações](#múltiplas-localizações)
5. [Sistema de Duplicados](#sistema-de-duplicados)
6. [Leads Ilimitados](#leads-ilimitados)
7. [API Endpoints](#api-endpoints)
8. [Exemplos de Uso](#exemplos-de-uso)

---

## 🎯 Visão Geral

O Google Maps Agent é uma ferramenta completa para prospecção automatizada de leads através do Google Maps, com recursos avançados de:
- Coleta automática de leads com enriquecimento de dados
- Múltiplas localizações geográficas
- Detecção e compensação automática de duplicados
- Dois modos de operação: CRM ou Lista
- Distribuição inteligente de leads

---

## ✨ Funcionalidades Implementadas

### ✅ Fase 1: Leads Ilimitados
- **Limite Configurável**: Escolha entre 20, 40, 60, 100, 200, 500, 1000 leads/dia ou ILIMITADO
- **Segurança**: Modo ilimitado limitado a 2000 leads por execução para proteção
- **Paginação Inteligente**: Salva progresso para trazer leads diferentes a cada dia

### ✅ Fase 2: CRM Opcional
**Modo CRM:**
- Cria contatos e oportunidades automaticamente
- Integra com pipeline de vendas
- Rodízio de atendentes configurável
- Ativação automática por WhatsApp/Email

**Modo Lista:**
- Apenas gera lista enriquecida de leads
- Exportação em CSV com todos os dados
- Ideal para análise e planejamento
- Sem criação de contatos no CRM

### ✅ Fase 3: Notificações
- Notificação quando campanha inicia
- Notificação de coleta diária concluída
- Notificação quando campanha finaliza
- Contador de duplicados nas notificações

### ✅ Fase 4: Duplicados com Compensação
- **Detecção Automática**: Identifica leads que já existem na base
- **Rastreamento**: Salva duplicados em tabela dedicada
- **Compensação Inteligente**: Busca páginas extras para compensar duplicados
  - Para cada 20 duplicados encontrados, busca +1 página extra
  - Garante que você receba o número de leads prometido
- **Endpoints Dedicados**:
  - `GET /api/google-maps-agents/:id/duplicates` - Lista duplicados
  - `GET /api/google-maps-agents/:id/duplicate-stats` - Estatísticas

### ✅ Fase 5: Raio Maior / Áreas Extensas
- **Tipos de Busca**: `radius`, `city`, `region`, `state`, `country`
- **Raio Customizável**: De 1km até 100km+
- **Zoom Automático**: Calcula zoom ideal baseado no raio

### ✅ Fase 6: Múltiplas Localizações
**Modo Proporcional:**
- Divide leads igualmente entre localizações
- Todas processadas a cada execução
- Exemplo: 100 leads/dia com 3 locais = ~33 leads por local

**Modo Sequencial:**
- Exaure completamente uma localização antes da próxima
- Salva progresso com `current_location_index`
- Exemplo: 100 leads/dia em São Paulo até esgotar, depois Rio

---

## 🔄 Modo CRM vs Modo Lista

### Modo CRM (Insert in CRM = true)
```
┌─────────────────────────────────────┐
│  GOOGLE MAPS SEARCH                 │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  ENRICHMENT                         │
│  ├─ Emails from website             │
│  ├─ Phones from website             │
│  ├─ Social links                    │
│  ├─ Company description             │
│  └─ Team members                    │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  DUPLICATE CHECK                    │
│  └─ Skip if exists + track          │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  CREATE IN CRM                      │
│  ├─ Contact created                 │
│  ├─ Opportunity created             │
│  ├─ Assigned to user (rotation)     │
│  └─ Activate WhatsApp/Email         │
└─────────────────────────────────────┘
```

### Modo Lista (Insert in CRM = false)
```
┌─────────────────────────────────────┐
│  GOOGLE MAPS SEARCH                 │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  ENRICHMENT                         │
│  ├─ Emails from website             │
│  ├─ Phones from website             │
│  ├─ Social links                    │
│  ├─ Company description             │
│  └─ Team members                    │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  SAVE TO found_places (JSONB)       │
│  └─ All data stored for export      │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  EXPORT AS CSV                      │
│  └─ Download enriched list          │
└─────────────────────────────────────┘
```

---

## 🗺️ Múltiplas Localizações

### Configuração

#### Modo Proporcional
```javascript
{
  "searchLocations": [
    {
      "id": "loc-1",
      "lat": -23.5505,
      "lng": -46.6333,
      "radius": 10,
      "location": "São Paulo, SP",
      "city": "São Paulo",
      "country": "Brasil",
      "searchType": "city"
    },
    {
      "id": "loc-2",
      "lat": -22.9068,
      "lng": -43.1729,
      "radius": 15,
      "location": "Rio de Janeiro, RJ",
      "city": "Rio de Janeiro",
      "country": "Brasil",
      "searchType": "radius"
    }
  ],
  "locationDistribution": "proportional",
  "dailyLimit": 100
}
```

**Resultado:**
- Execução 1: 50 leads SP + 50 leads RJ
- Execução 2: 50 leads SP + 50 leads RJ
- Execução 3: 50 leads SP + 50 leads RJ

#### Modo Sequencial
```javascript
{
  "searchLocations": [...],
  "locationDistribution": "sequential",
  "dailyLimit": 100
}
```

**Resultado:**
- Execução 1-10: 100 leads/dia de SP (até esgotar)
- Execução 11-20: 100 leads/dia de RJ (até esgotar)
- Execução 21-30: 100 leads/dia de BH (até esgotar)

---

## 🔍 Sistema de Duplicados

### Como Funciona

1. **Detecção**: Verifica `place_id` na tabela `contacts`
2. **Rastreamento**: Salva em `google_maps_agent_duplicates`
3. **Compensação**: Para cada 20 duplicados, busca +1 página extra

### Exemplo Prático

```
Configuração:
- Daily Limit: 100 leads
- Páginas necessárias: 5 (100 ÷ 20)

Execução:
┌──────────┬───────────┬────────────┬────────────────┐
│ Página   │ Encontrou │ Duplicados │ Ação           │
├──────────┼───────────┼────────────┼────────────────┤
│ 1        │ 20        │ 3          │ Inserir 17     │
│ 2        │ 20        │ 7          │ Inserir 13     │
│ 3        │ 20        │ 5          │ Inserir 15     │
│ 4        │ 20        │ 2          │ Inserir 18     │
│ 5        │ 20        │ 3          │ Inserir 17     │
├──────────┼───────────┼────────────┼────────────────┤
│ Total    │ 100       │ 20         │ 80 inseridos   │
├──────────┼───────────┼────────────┼────────────────┤
│ Comp. +1 │ 20        │ 0          │ +20 inseridos  │
└──────────┴───────────┴────────────┴────────────────┘

Resultado: ~100 leads novos (compensação automática)
```

### Consultar Duplicados

```bash
# Listar duplicados
GET /api/google-maps-agents/{id}/duplicates?limit=50&offset=0

# Estatísticas
GET /api/google-maps-agents/{id}/duplicate-stats
```

**Resposta:**
```json
{
  "success": true,
  "stats": {
    "duplicates_found": 156,
    "duplicates_tracked": 156
  }
}
```

---

## 📊 Leads Ilimitados

### Opções de Daily Limit

| Valor | Páginas/dia | Créditos GMaps/dia | Uso Recomendado |
|-------|-------------|-------------------|-----------------|
| 20    | 1           | 1                 | Teste           |
| 40    | 2           | 2                 | Pequeno         |
| 60    | 3           | 3                 | Médio           |
| 100   | 5           | 5                 | Padrão          |
| 200   | 10          | 10                | Grande          |
| 500   | 25          | 25                | Muito Grande    |
| 1000  | 50          | 50                | Agressivo       |
| null  | até 100     | variável          | Ilimitado*      |

*Modo ilimitado limitado a 2000 leads por execução (segurança)

### Configuração

```javascript
{
  "dailyLimit": null, // Ilimitado
  // ou
  "dailyLimit": 100   // Limitado
}
```

---

## 🔌 API Endpoints

### Campanhas

```bash
# Criar campanha
POST /api/google-maps-agents
{
  "name": "Academias São Paulo",
  "searchLocations": [...],
  "locationDistribution": "proportional",
  "insertInCrm": true,
  "dailyLimit": 100,
  "sectorId": "uuid",
  "assignees": ["user1", "user2"]
}

# Listar campanhas
GET /api/google-maps-agents

# Obter campanha
GET /api/google-maps-agents/{id}

# Atualizar campanha
PUT /api/google-maps-agents/{id}

# Executar manualmente
POST /api/google-maps-agents/{id}/execute

# Pausar/Retomar
PUT /api/google-maps-agents/{id}/pause
PUT /api/google-maps-agents/{id}/resume

# Deletar
DELETE /api/google-maps-agents/{id}?deleteLeads=true
```

### Modo Lista

```bash
# Obter leads encontrados (JSON)
GET /api/google-maps-agents/{id}/found-places

# Exportar CSV
GET /api/google-maps-agents/{id}/export-found-places
```

### Duplicados

```bash
# Listar duplicados
GET /api/google-maps-agents/{id}/duplicates?limit=50&offset=0

# Estatísticas
GET /api/google-maps-agents/{id}/duplicate-stats
```

### Rodízio

```bash
# Obter atendentes
GET /api/google-maps-agents/{id}/assignees

# Definir atendentes
PUT /api/google-maps-agents/{id}/assignees
{
  "userIds": ["user1", "user2", "user3"]
}

# Histórico de distribuição
GET /api/google-maps-agents/{id}/assignments?limit=50
```

---

## 💡 Exemplos de Uso

### Exemplo 1: Campanha Simples (Modo CRM)

```javascript
// Criar campanha para academias em São Paulo
const response = await fetch('/api/google-maps-agents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Academias São Paulo',
    searchLocation: 'São Paulo, SP',
    searchCountry: 'Brasil',
    latitude: -23.5505,
    longitude: -46.6333,
    radius: 15,
    searchType: 'city',
    searchQuery: 'Academia',
    businessCategory: 'gym',
    insertInCrm: true,
    dailyLimit: 100,
    sectorId: 'uuid-do-setor',
    assignees: ['user1', 'user2']
  })
});
```

### Exemplo 2: Múltiplas Localizações (Modo Lista)

```javascript
// Criar campanha para restaurantes em 3 cidades
const response = await fetch('/api/google-maps-agents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Restaurantes Região Sudeste',
    searchLocations: [
      {
        id: 'sp',
        city: 'São Paulo',
        country: 'Brasil',
        lat: -23.5505,
        lng: -46.6333,
        radius: 10,
        searchType: 'city'
      },
      {
        id: 'rj',
        city: 'Rio de Janeiro',
        country: 'Brasil',
        lat: -22.9068,
        lng: -43.1729,
        radius: 10,
        searchType: 'city'
      },
      {
        id: 'bh',
        city: 'Belo Horizonte',
        country: 'Brasil',
        lat: -19.9167,
        lng: -43.9345,
        radius: 10,
        searchType: 'city'
      }
    ],
    locationDistribution: 'proportional',
    searchQuery: 'Restaurante',
    businessCategory: 'restaurant',
    insertInCrm: false, // Modo Lista
    dailyLimit: 300 // 100 por cidade
  })
});

// Exportar CSV após coleta
const csv = await fetch(`/api/google-maps-agents/${agentId}/export-found-places`);
```

### Exemplo 3: Campanha com Filtros Avançados

```javascript
const response = await fetch('/api/google-maps-agents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Dentistas Premium RJ',
    searchLocation: 'Rio de Janeiro, RJ',
    searchCountry: 'Brasil',
    latitude: -22.9068,
    longitude: -43.1729,
    radius: 20,
    searchType: 'city',
    searchQuery: 'Dentista',
    businessCategory: 'dentist',
    businessSpecification: 'Implante Dentário',

    // Filtros de qualidade
    minRating: 4.5,
    minReviews: 50,

    // CRM e ativação
    insertInCrm: true,
    activateWhatsapp: true,
    whatsappAgentId: 'uuid-do-agente',

    // Limite e rodízio
    dailyLimit: 60,
    sectorId: 'uuid-setor-saude',
    assignees: ['vendedor1', 'vendedor2', 'vendedor3']
  })
});
```

---

## 🎨 Interface do Usuário

### Fluxo de Criação

1. **Passo 1: Nome**
   - Digite um nome descritivo para a campanha

2. **Passo 2: Localização**
   - Toggle: Localização Única ou Múltiplas
   - **Única**: Selecione no mapa
   - **Múltiplas**:
     - Adicione localizações
     - Escolha distribuição (Proporcional/Sequencial)

3. **Passo 3: Nicho**
   - Categoria principal (opcional)
   - Especificação (opcional)
   - Pelo menos um obrigatório

4. **Passo 4: Filtros**
   - Avaliação mínima
   - Mínimo de avaliações
   - Leads por dia

5. **Passo 5: Ações**
   - **Inserir no CRM** ou **Apenas gerar lista**
   - Ativação por WhatsApp/Email (se CRM)

6. **Passo 6: Setor e Rodízio** (só se CRM)
   - Setor dos leads
   - Atendentes em rodízio

---

## 📈 Monitoramento

### Logs de Execução

```bash
# Console logs durante execução:
📍 Proportional mode: 2 pages per location across 3 locations
📍 Processing location 1/3: São Paulo, SP
✅ Agent xxx: Page 1 - +18 leads
🔄 Duplicate compensation: 5 duplicates found, adding 1 extra page(s)
✅ Location 1/3 complete: 18 leads total so far
```

### WebSocket Events

O sistema emite eventos em tempo real:
- `gmaps:collecting` - Buscando leads
- `gmaps:enriching` - Enriquecendo dados
- `gmaps:saving` - Salvando no CRM
- `gmaps:complete` - Finalizado

---

## 🔐 Segurança

- ✅ Multi-tenancy: Filtro por `account_id`
- ✅ Setor: Filtro por setores acessíveis
- ✅ Autenticação: Token JWT obrigatório
- ✅ Rate Limiting: Proteção contra abuso
- ✅ Validação: Entrada sanitizada

---

## 💰 Custos

- **API Google Maps**: $0.00275 USD por consulta
- **Créditos GMaps**: 1 crédito = 1 página (20 leads)
- **Daily Limit**: Define consumo diário de créditos

**Exemplo:**
- Daily Limit = 100 leads
- Páginas = 5
- Custo/dia = 5 × $0.00275 = $0.01375 USD
- Custo/mês = ~$0.41 USD

---

## 🐛 Troubleshooting

### Campanha não executa
- Verificar status: deve estar `active`
- Verificar créditos GMaps disponíveis
- Verificar logs: `GET /api/google-maps-agents/{id}/logs`

### Muitos duplicados
- Normal em mercados saturados
- Sistema compensa automaticamente
- Ver duplicados: `GET /api/google-maps-agents/{id}/duplicates`

### Modo sequencial não avança
- Verificar `current_location_index`
- Localização pode ainda ter resultados
- Aguardar completar antes de avançar

---

## 🎉 Conclusão

O Google Maps Agent oferece a solução mais completa para prospecção automatizada:

✅ 6 Fases implementadas
✅ Múltiplas localizações
✅ Compensação de duplicados
✅ Leads ilimitados
✅ Modo CRM e Lista
✅ Enriquecimento automático
✅ API completa

**Pronto para uso em produção!** 🚀
