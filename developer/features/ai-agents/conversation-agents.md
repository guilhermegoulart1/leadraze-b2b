# Conversation Agents

Conversation Agents (also called AI Agents or LinkedIn Agents) handle LinkedIn conversations automatically. They respond to messages using configured behavioral profiles.

## Creating a LinkedIn Agent

Navigate to **AI Agents** → **Create Agent** → select **LinkedIn**.

The wizard has 6 steps:

### Step 1: Identity

| Field | Required | Description |
|-------|----------|-------------|
| Avatar | No | Auto-generated, click refresh to change |
| Name | Yes | Agent name (e.g., "Agente de Vendas LinkedIn") |
| Description | No | Agent purpose description |
| Agent Type | Yes | Select "LinkedIn" |

### Step 2: Products & Services

| Field | Required | Validation |
|-------|----------|------------|
| Produtos/Serviços | Yes | Minimum 10 characters |

Describe what your company offers. This information helps the agent respond accurately.

**Placeholder:** "Descreva seus produtos e serviços..."

### Step 3: Business Information

All fields are optional but improve agent responses.

| Field | Description |
|-------|-------------|
| Descrição da Empresa | Company overview |
| Proposta de Valor | Your value proposition |
| Diferenciais | Comma-separated differentiators |

**Differentiators placeholder:** "Qualidade, Suporte 24/7, Garantia vitalícia..."

### Step 4: Behavioral Profile

Select one profile that defines how the agent communicates:

| Profile | Key | Description |
|---------|-----|-------------|
| Consultivo | `consultivo` | Asks questions, understands problems before offering solutions |
| Direto | `direto` | Direct, quick value presentation |
| Educativo | `educativo` | Shares insights and adds value before selling |
| Amigável | `amigavel` | Casual, personal connection approach |

### Step 5: Escalation Rules

Configure when the agent should transfer to a human.

| Field | Type | Default |
|-------|------|---------|
| Transferir em perguntas sobre preço | Checkbox | false |
| Transferir em perguntas técnicas específicas | Checkbox | false |
| Definir máximo de mensagens | Checkbox | false |
| Max messages (if enabled) | Number | 10 (range: 1-50) |

### Step 6: Final Configuration

| Field | Required | Description |
|-------|----------|-------------|
| Abordagem Inicial | Yes | First message template (4 rows textarea) |
| Tamanho das Respostas | No | short, medium (default), long |
| Agendar reuniões automaticamente | No | Auto-schedule checkbox |
| Link de Agendamento | Conditional | Required if auto-schedule enabled |

## Message Variables

Use these in the initial approach:

| Variable | Description |
|----------|-------------|
| `{{nome}}` | Lead name |
| `{{empresa}}` | Company |
| `{{cargo}}` | Job title |
| `{{localizacao}}` | Location |
| `{{industria}}` | Industry |
| `{{conexoes}}` | Connection count |
| `{{resumo}}` | Profile summary |

**Example:**
```
Olá {{nome}}, vi que você é {{cargo}} na {{empresa}}.

Trabalho com empresas do setor de {{industria}} ajudando
a automatizar a geração de leads. Podemos conversar?
```

## Knowledge Base

Add knowledge items to improve responses:

1. Open agent settings
2. Click **Knowledge Base**
3. Add items with question/answer pairs

## Testing

1. Click **Test** on the agent card
2. Choose test type:
   - Test Initial Message
   - Test Response
3. Review output and adjust

## Response Length Options

| Value | Label | Description |
|-------|-------|-------------|
| `short` | Curtas | 1-2 lines |
| `medium` | Médias | 2-4 lines |
| `long` | Longas | 4-6 lines |
