# Agentes de Conversa

Agentes de Conversa (também chamados de Agentes LinkedIn) gerenciam conversas no LinkedIn automaticamente, respondendo a mensagens usando perfis comportamentais configurados.

## Criando um Agente LinkedIn

Navegue até **Agentes IA** → **Criar Agente** → selecione **LinkedIn**.

O assistente tem 6 etapas:

### Etapa 1: Identidade

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| Avatar | Não | Gerado automaticamente, clique em atualizar para trocar |
| Nome | Sim | Nome do agente (ex: "Agente de Vendas LinkedIn") |
| Descrição | Não | Descrição do propósito do agente |
| Tipo de Agente | Sim | Selecione "LinkedIn" |

### Etapa 2: Produtos e Serviços

| Campo | Obrigatório | Validação |
|-------|-------------|-----------|
| Produtos/Serviços | Sim | Mínimo 10 caracteres |

Descreva o que sua empresa oferece. Esta informação ajuda o agente a responder com precisão.

### Etapa 3: Informações do Negócio

Todos os campos são opcionais mas melhoram as respostas do agente.

| Campo | Descrição |
|-------|-----------|
| Descrição da Empresa | Visão geral da empresa |
| Proposta de Valor | Sua proposta de valor |
| Diferenciais | Diferenciais separados por vírgula |

**Placeholder dos diferenciais:** "Qualidade, Suporte 24/7, Garantia vitalícia..."

### Etapa 4: Perfil Comportamental

Selecione um perfil que define como o agente se comunica:

| Perfil | Chave | Descrição |
|--------|-------|-----------|
| Consultivo | `consultivo` | Faz perguntas, entende problemas antes de oferecer soluções |
| Direto | `direto` | Direto ao ponto, apresentação rápida de valor |
| Educativo | `educativo` | Compartilha insights e agrega valor antes de vender |
| Amigável | `amigavel` | Casual, foco em conexão pessoal |

### Etapa 5: Regras de Escalonamento

Configure quando o agente deve transferir para um humano.

| Campo | Tipo | Padrão |
|-------|------|--------|
| Transferir em perguntas sobre preço | Checkbox | false |
| Transferir em perguntas técnicas específicas | Checkbox | false |
| Definir máximo de mensagens | Checkbox | false |
| Máximo de mensagens (se habilitado) | Número | 10 (intervalo: 1-50) |

### Etapa 6: Configuração Final

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| Abordagem Inicial | Sim | Template da primeira mensagem (textarea 4 linhas) |
| Tamanho das Respostas | Não | short, medium (padrão), long |
| Agendar reuniões automaticamente | Não | Checkbox de auto-agendamento |
| Link de Agendamento | Condicional | Obrigatório se auto-agendamento habilitado |

## Variáveis de Mensagem

Use estas variáveis na abordagem inicial:

| Variável | Descrição |
|----------|-----------|
| `{{nome}}` | Nome do lead |
| `{{empresa}}` | Empresa |
| `{{cargo}}` | Cargo |
| `{{localizacao}}` | Localização |
| `{{industria}}` | Indústria |
| `{{conexoes}}` | Número de conexões |
| `{{resumo}}` | Resumo do perfil |

**Exemplo:**
```
Olá {{nome}}, vi que você é {{cargo}} na {{empresa}}.

Trabalho com empresas do setor de {{industria}} ajudando
a automatizar a geração de leads. Podemos conversar?
```

## Base de Conhecimento

Adicione itens de conhecimento para melhorar as respostas:

1. Abra as configurações do agente
2. Clique em **Base de Conhecimento**
3. Adicione itens com pares de pergunta/resposta

## Testando

1. Clique em **Testar** no card do agente
2. Escolha o tipo de teste:
   - Testar Mensagem Inicial
   - Testar Resposta
3. Revise a saída e ajuste

## Opções de Tamanho de Resposta

| Valor | Label | Descrição |
|-------|-------|-----------|
| `short` | Curtas | 1-2 linhas |
| `medium` | Médias | 2-4 linhas |
| `long` | Longas | 4-6 linhas |
