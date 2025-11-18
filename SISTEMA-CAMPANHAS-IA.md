# Sistema de Campanhas com IA - LeadRaze

## Arquitetura do Sistema

### 1. Tipos de Campanha

#### Manual
- Usuário define filtros manualmente na tela de busca
- Tem controle total sobre os critérios
- Vê preview dos resultados antes de coletar

#### Automática (com IA)
- Usuário descreve o perfil desejado em linguagem natural
- OpenAI analisa e gera filtros otimizados
- Sistema aplica automaticamente no LinkedIn (modo Classic)

---

### 2. Fluxo de Criação em 3 Etapas

```
┌─────────────────────────────────────────┐
│  ETAPA 1: BUSCA                         │
│                                         │
│  ┌─────────────┐   ┌──────────────┐   │
│  │   MANUAL    │   │  AUTOMÁTICA  │   │
│  │             │   │   (OpenAI)   │   │
│  └─────────────┘   └──────────────┘   │
│                                         │
│  Manual: Vai para tela de busca        │
│  Automática: Descreve perfil → IA gera │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│  ETAPA 2: COLETA                        │
│                                         │
│  - Define quantidade de perfis         │
│  - Visualiza filtros aplicados          │
│  - Inicia coleta via Unipile            │
│  - Acompanha progresso                  │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│  ETAPA 3: VALIDAÇÃO                     │
│                                         │
│  - Escolhe Agente de IA                 │
│  - Revisa configurações                 │
│  - Botão INICIAR CAMPANHA               │
└─────────────────────────────────────────┘
```

---

### 3. Sistema de Agentes de IA

#### Modal de Criação

**Passo 1: Produtos/Serviços**
```
┌────────────────────────────────────┐
│ Descreva seus produtos/serviços   │
│ ┌────────────────────────────────┐│
│ │ Ex: Consultoria em Marketing   ││
│ │ Digital para e-commerce B2B    ││
│ └────────────────────────────────┘│
│                                    │
│            [Avançar →]             │
└────────────────────────────────────┘
```

**Passo 2: Perfil Comportamental**
```
┌────────────────────────────────────┐
│ Escolha o perfil do agente:        │
│                                    │
│ ○ Consultivo                       │
│   Faz perguntas, entende problemas │
│                                    │
│ ○ Direto ao Ponto                  │
│   Apresenta solução rapidamente    │
│                                    │
│ ○ Educativo                        │
│   Compartilha conhecimento         │
│                                    │
│ ○ Amigável                         │
│   Casual, próximo                  │
│                                    │
│            [Avançar →]             │
└────────────────────────────────────┘
```

**Passo 3: Configurações**
```
┌────────────────────────────────────┐
│ Nome do Agente:                    │
│ [__________________________]       │
│                                    │
│ Abordagem Inicial: (editável)     │
│ ┌────────────────────────────────┐│
│ │ Olá {{nome}},                  ││
│ │ Vi que você trabalha em        ││
│ │ {{empresa}} como {{cargo}}.    ││
│ │                                ││
│ │ [Sugestão baseada no perfil]   ││
│ └────────────────────────────────┘│
│                                    │
│ ☑ Agendar automaticamente          │
│   Link: [Calendly/outro]           │
│                                    │
│ ☑ Detectar intenção/interesse      │
│                                    │
│            [Criar Agente]          │
└────────────────────────────────────┘
```

#### Variáveis Disponíveis do LinkedIn
- `{{nome}}` - Nome do lead
- `{{empresa}}` - Empresa atual
- `{{cargo}}` - Cargo/título
- `{{localizacao}}` - Localização
- `{{industria}}` - Indústria/setor
- `{{conexoes}}` - Número de conexões
- `{{resumo}}` - Resumo do perfil

---

### 4. Perfis Comportamentais Sugeridos

#### 1. Consultivo 🎯
**Características:**
- Faz perguntas abertas
- Entende dores antes de oferecer solução
- Construção de relacionamento
- Tom: profissional e empático

**Prompt Base:**
```
Você é um consultor experiente. Seu objetivo é entender as necessidades do lead
antes de apresentar soluções. Faça perguntas abertas, seja empático e construa
relacionamento. Respostas curtas (máximo 2-3 frases).
```

#### 2. Direto ao Ponto ⚡
**Características:**
- Apresenta valor rapidamente
- Vai direto à solução
- Economiza tempo do lead
- Tom: profissional e objetivo

**Prompt Base:**
```
Você é direto e objetivo. Apresente o valor da sua solução rapidamente.
Não enrole, vá direto ao ponto. Respostas curtas (1-2 frases).
```

#### 3. Educativo 📚
**Características:**
- Compartilha insights
- Agrega valor antes de vender
- Posiciona como especialista
- Tom: informativo e prestativo

**Prompt Base:**
```
Você é um educador. Compartilhe insights valiosos sobre o tema antes de
apresentar sua solução. Posicione-se como especialista. Respostas curtas
com dicas práticas (2-3 frases).
```

#### 4. Amigável 😊
**Características:**
- Tom casual e próximo
- Cria conexão pessoal
- Linguagem descontraída
- Tom: amigável e autêntico

**Prompt Base:**
```
Você é amigável e autêntico. Use linguagem casual (mas profissional).
Crie conexão pessoal com o lead. Respostas curtas e descontraídas (2-3 frases).
```

---

### 5. Sistema de Detecção de Intenção

O agente analisa as respostas do lead para detectar:

#### Sinais Positivos (Interesse) ✅
- Perguntas sobre preço/valores
- Pedido de mais informações
- Menção de problemas que você resolve
- Disponibilidade para reunião
- Compartilhamento de contato

#### Sinais Neutros ⚪
- Respostas curtas
- Agradecimento genérico
- Pedido para "guardar contato"

#### Sinais Negativos (Sem Interesse) ❌
- "Não tenho interesse"
- "Já temos fornecedor"
- "Não é prioridade agora"
- Sem resposta após 3 tentativas

#### Ações Automáticas
```javascript
if (intencao === 'positiva') {
  // Move para QUALIFICAÇÃO
  // Se auto_schedule === true: oferece agendamento
  lead.status = 'qualifying';
  if (agent.auto_schedule) {
    sendMessage(`Ótimo! Que tal agendar uma conversa? ${agent.scheduling_link}`);
  }
}

if (intencao === 'muito_positiva' && agent.auto_schedule) {
  // Move para AGENDAMENTO
  lead.status = 'scheduled';
}

if (intencao === 'negativa') {
  // Move para PERDIDO
  lead.status = 'lost';
  lead.lost_reason = 'Sem interesse detectado';
}
```

---

### 6. Regras de Resposta

#### Sempre:
- ✅ Respostas curtas (máximo 3 frases)
- ✅ Dar espaço para o lead falar
- ✅ Uma pergunta por mensagem
- ✅ Evitar parecer robótico

#### Nunca:
- ❌ Respostas longas
- ❌ Múltiplas perguntas de uma vez
- ❌ Forçar venda
- ❌ Ignorar contexto da conversa

---

### 7. Integração OpenAI para Busca Automática

#### Prompt para Geração de Filtros

```javascript
const prompt = `
Você é um especialista em LinkedIn Sales Navigator.

Baseado nesta descrição do perfil ideal:
"${userDescription}"

Gere os filtros de busca no formato JSON abaixo. Use apenas filtros disponíveis
no modo Classic do LinkedIn (não Sales Navigator Premium).

Filtros disponíveis:
- keywords: string (palavras-chave para buscar no perfil)
- location: array de strings (cidades/regiões)
- industries: array de strings (indústrias/setores)
- job_titles: array de strings (cargos/títulos)
- companies: array de strings (empresas - opcional)

Retorne APENAS o JSON, sem explicações:

{
  "keywords": "palavra-chave relevante",
  "location": ["São Paulo, SP", "Rio de Janeiro, RJ"],
  "industries": ["Tecnologia", "Software"],
  "job_titles": ["CEO", "CTO", "Founder"],
  "companies": [] // apenas se mencionado explicitamente
}
`;
```

#### Exemplo de Uso

**Input do usuário:**
```
"Quero encontrar CEOs e fundadores de startups de tecnologia em São Paulo
e Rio de Janeiro que trabalhem com SaaS B2B"
```

**Output da OpenAI:**
```json
{
  "keywords": "SaaS B2B startup",
  "location": ["São Paulo, SP", "Rio de Janeiro, RJ"],
  "industries": ["Tecnologia", "Software", "Internet"],
  "job_titles": ["CEO", "Founder", "Co-Founder"],
  "companies": []
}
```

---

### 8. Fluxo Completo de Ativação

```
1. Usuário cria campanha (Manual ou Automática)
   ↓
2. Define filtros (manual) OU descreve perfil (IA gera filtros)
   ↓
3. Define quantidade de perfis (ex: 200)
   ↓
4. Sistema inicia coleta via Unipile
   ↓
5. Perfis coletados → inseridos no CRM como "LEAD"
   ↓
6. Usuário escolhe Agente de IA
   ↓
7. Usuário clica "INICIAR CAMPANHA"
   ↓
8. Campanha fica ativa
   ↓
9. [FUTURO] Convites automáticos via Unipile
   ↓
10. Quando lead aceita convite:
    - Status: LEAD → CONVITE ENVIADO → QUALIFICAÇÃO
    - Agente inicia conversa com abordagem inicial
    ↓
11. Agente conversa e detecta intenção:
    - Interesse alto → AGENDAMENTO (se auto_schedule)
    - Interesse médio → QUALIFICAÇÃO
    - Sem interesse → PERDIDO
    ↓
12. Lead agendou reunião → GANHO (após conversão)
```

---

### 9. Estrutura de Dados

#### Campaign (atualizada)
```javascript
{
  id: UUID,
  user_id: UUID,
  name: string,
  description: string,
  type: 'manual' | 'automatic',
  current_step: 1 | 2 | 3,
  status: 'draft' | 'active' | 'paused' | 'completed',

  // Busca
  search_filters: {
    keywords: string,
    location: string[],
    industries: string[],
    job_titles: string[],
    companies: string[]
  },
  ai_search_prompt: string, // apenas se type === 'automatic'

  // Coleta
  target_profiles_count: number,

  // Validação
  ai_agent_id: UUID,

  // Estatísticas
  total_leads: number,
  leads_pending: number,
  leads_sent: number,
  leads_qualifying: number,
  leads_scheduled: number,
  leads_won: number,
  leads_lost: number
}
```

#### AI Agent (atualizada)
```javascript
{
  id: UUID,
  user_id: UUID,
  name: string,
  description: string,

  // Configuração
  products_services: string,
  behavioral_profile: 'consultivo' | 'direto' | 'educativo' | 'amigavel',

  // Abordagem
  initial_approach: string, // com variáveis {{nome}}, etc
  linkedin_variables: {
    available: ['nome', 'empresa', 'cargo', 'localizacao', 'industria', 'conexoes', 'resumo'],
    used: ['nome', 'empresa'] // quais foram usadas na abordagem
  },

  // Agendamento
  auto_schedule: boolean,
  scheduling_link: string, // Calendly, etc

  // IA
  intent_detection_enabled: boolean,
  response_style_instructions: string,

  // Status
  is_active: boolean,
  language: 'pt-BR'
}
```

---

## Próximos Passos de Implementação

1. ✅ Schema do banco atualizado
2. 🔄 Criar página de Campanhas com wizard
3. ⏳ Criar modal de criação de Agente
4. ⏳ Integrar OpenAI para gerar filtros
5. ⏳ Sistema de detecção de intenção
6. ⏳ Movimentação automática no pipeline

---

**Status:** Em desenvolvimento 🚀
