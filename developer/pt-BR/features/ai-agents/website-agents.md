# Agentes Website

Agentes Website alimentam o widget de chat no site da sua empresa. Eles gerenciam consultas de visitantes, qualificam leads e fornecem suporte 24/7.

## Visão Geral

Agentes Website fornecem:
- Suporte de chat em tempo real no seu site
- Respostas com IA usando sua base de conhecimento
- Captura e qualificação de leads
- Escalonamento para agentes humanos quando necessário

## Agentes Pré-configurados

O GetRaze inclui dois agentes de website pré-configurados:

### Agente de Vendas
- **Propósito**: Gerenciar consultas de vendas de visitantes
- **Chave**: `sales`
- **Mensagem Padrão**: "Olá! Estou aqui para ajudá-lo a conhecer nossos produtos e serviços."

### Agente de Suporte
- **Propósito**: Fornecer suporte técnico e responder perguntas
- **Chave**: `support`
- **Mensagem Padrão**: "Olá! Estou aqui para ajudar com qualquer dúvida técnica."

## Configuração do Agente

### Configurações Básicas

| Campo | Descrição |
|-------|-----------|
| Nome | Nome exibido no widget de chat |
| Avatar URL | Foto de perfil do agente |
| Mensagem de Boas-vindas | Primeira mensagem quando o chat abre |
| Personalidade | Como o agente deve se comportar |
| System Prompt | Instruções da IA (avançado) |

### Configurações de Comunicação

| Campo | Opções | Descrição |
|-------|--------|-----------|
| Tom | Professional, Friendly, Casual, Formal | Estilo de comunicação |
| Tamanho da Resposta | Short, Medium, Long | Quão detalhadas devem ser as respostas |
| Idioma | en, pt-br, es | Idioma principal |

## Base de Conhecimento

A base de conhecimento treina seu agente para responder perguntas com precisão.

### Tipos de Conhecimento

| Tipo | Descrição | Uso |
|------|-----------|-----|
| FAQ | Perguntas e respostas comuns | Dúvidas frequentes |
| Product | Detalhes e especificações | Informações de produtos |
| Feature | Funcionalidades | Recursos do sistema |
| Pricing | Planos e opções de preço | Informações comerciais |
| Policy | Políticas da empresa | Termos e condições |

### Adicionando Itens de Conhecimento

1. Navegue até **Agentes Website** → **Base de Conhecimento**
2. Clique em **Adicionar Conhecimento**
3. Preencha os campos:

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| Tipo | Sim | Categoria do conhecimento |
| Pergunta | Para FAQ | A pergunta sendo respondida |
| Resposta | Para FAQ | A resposta a fornecer |
| Conteúdo | Para outros | Conteúdo geral |
| Categoria | Não | Classificação do tópico |
| Agente | Não | Compartilhado ou específico (Sales/Support) |

## Sessões de Chat

### Visualizando Conversas

Navegue até **Agentes Website** → **Conversas** para ver:
- Sessões de chat ativas e passadas
- Histórico de mensagens
- Status de escalonamento

### Filtros de Conversas

| Filtro | Opções |
|--------|--------|
| Agente | Todos, Sales, Support |
| Status | Todos, Escalonados, Não Escalonados |

### Escalonamento

Quando a IA não consegue responder:
1. Sessão é marcada como "Escalonada"
2. Notificação enviada para a equipe
3. Agente humano pode assumir
4. Formulário de contato pode ser exibido

## Estatísticas

Acompanhe o desempenho dos seus agentes:

| Métrica | Descrição |
|---------|-----------|
| Total de Conversas | Número de sessões de chat |
| Total de Mensagens | Mensagens trocadas |
| Escalonadas | Conversas escalonadas para humanos |
| Média de Mensagens | Mensagens médias por conversa |

### Estatísticas por Agente

Visualize métricas separadas para cada agente (Sales/Support):
- Conversas
- Mensagens
- Escalonamentos
- Comprimento médio

## Gerenciando Agentes

### Editar Configurações
1. Vá em **Agentes Website**
2. Clique no card do agente
3. Modifique as configurações
4. Salve as alterações

### Alternar Status do Agente
1. Encontre o agente na lista
2. Alterne o switch de ativo
3. Agentes inativos não responderão aos chats

## Melhores Práticas

### Para Agente de Vendas
- Foque na proposta de valor
- Faça perguntas de qualificação
- Ofereça demos/reuniões
- Capture informações de contato

### Para Agente de Suporte
- Forneça soluções passo a passo
- Link para documentação
- Escalone problemas complexos
- Acompanhe a resolução

### Dicas Gerais
- Mantenha respostas concisas
- Use linguagem clara
- Forneça próximos passos
- Sempre ofereça opção humana
