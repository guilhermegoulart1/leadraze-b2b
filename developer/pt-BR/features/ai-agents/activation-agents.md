# Agentes de Ativação

Agentes de Ativação são projetados para campanhas de alcance via Email, WhatsApp e LinkedIn. Eles enviam mensagens personalizadas para suas listas de contatos e gerenciam o engajamento inicial.

## Visão Geral

Use Agentes de Ativação para:
- Lançar campanhas de alcance multicanal
- Enviar mensagens personalizadas em escala
- Fazer follow-up com leads automaticamente
- Manter tom de comunicação consistente

## Canais Suportados

| Canal | Descrição | Melhor Para |
|-------|-----------|-------------|
| **Email** | Alcance profissional por email | Comunicação B2B, alcance formal |
| **WhatsApp** | Mensagens diretas | Respostas rápidas, mercados informais |
| **LinkedIn** | Networking profissional | Vendas B2B, serviços profissionais |

## Criando um Agente de Ativação

Navegue até **Agentes de Ativação** → **Criar Agente** para iniciar o assistente.

### Etapa 1: Identidade do Agente

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| Nome | Sim | Nome do agente (ex: "Ana Silva - Vendas") |
| Descrição | Não | O que este agente faz |
| Avatar | Auto | Gerado automaticamente, pode ser atualizado |

### Etapa 2: Tipo de Ativação

Escolha o canal de comunicação.

| Tipo | Descrição |
|------|-----------|
| Email | Enviar emails através de contas conectadas |
| WhatsApp | Enviar mensagens pelo WhatsApp Business |
| LinkedIn | Enviar mensagens no LinkedIn |

::: warning
Você pode selecionar apenas um canal por agente. Crie múltiplos agentes para campanhas multicanal.
:::

### Etapa 3: Personalidade e Tom

Configure como seu agente se comunica.

| Campo | Opções | Descrição |
|-------|--------|-----------|
| Tom | Formal, Casual, Profissional, Amigável | Estilo de comunicação |
| Idioma | Português (BR), English (US), Español | Idioma das mensagens |
| Personalidade | Texto livre | Descrição da personalidade |

**Exemplos de Tom:**

| Tom | Exemplo de Abertura |
|-----|---------------------|
| Formal | "Prezado Sr. Silva, espero que esta mensagem o encontre bem." |
| Casual | "E aí João! Uma pergunta rápida pra você." |
| Profissional | "Olá João, percebi que sua empresa está crescendo rapidamente." |
| Amigável | "Oi João! Espero que esteja tendo uma ótima semana!" |

### Etapa 4: Mensagens

Defina as mensagens que seu agente enviará.

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| Mensagem Inicial | Sim | Primeira mensagem de alcance |
| Mensagem de Follow-up | Não | Mensagem enviada se não houver resposta |
| Instruções Customizadas | Não | Instruções especiais para o agente |

**Exemplo de Mensagem Inicial:**
```
Olá {{nome}}, tudo bem?

Meu nome é {{agente}} e trabalho na {{empresa}}.

Ajudamos empresas como a sua a aumentar leads qualificados
em 3x através de automação com IA.

Podemos conversar sobre isso?
```

**Variáveis disponíveis:** `{{nome}}`, `{{empresa}}`, `{{cargo}}`, `{{agente}}`

### Etapa 5: Revisão

Revise todas as configurações antes de criar:
- Identidade do agente (nome, avatar)
- Canal selecionado
- Estilo de comunicação
- Templates de mensagem

## Estatísticas do Agente

Acompanhe o desempenho no card do agente:

| Métrica | Descrição |
|---------|-----------|
| Campanhas | Número de campanhas usando este agente |
| Ativas | Campanhas em execução |

## Gerenciando Agentes

### Editar Agente
1. Clique no ícone de edição no card
2. Modifique as configurações
3. Salve as alterações

### Desativar Agente
1. Alterne o switch de ativo para off
2. Agente não estará disponível para novas campanhas

### Deletar Agente
1. Clique no ícone de deletar
2. Confirme a exclusão

::: warning
Você não pode deletar agentes atribuídos a campanhas ativas. Pause ou complete as campanhas primeiro.
:::

## Melhores Práticas

### Escrita de Mensagens
- Mantenha mensagens iniciais curtas (menos de 150 palavras)
- Foque em valor, não em funcionalidades
- Faça uma pergunta clara
- Personalize com variáveis

### Seleção de Tom
- Combine com a voz da sua marca
- Considere seu público
- Teste diferentes tons

### Estratégia de Follow-up
- Espere 3-5 dias antes do follow-up
- Referencie a mensagem anterior
- Adicione novo valor ou ângulo
- Limite a 2-3 follow-ups
