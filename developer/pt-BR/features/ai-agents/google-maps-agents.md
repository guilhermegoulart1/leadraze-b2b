# Agentes Google Maps

Agentes Google Maps coletam leads de empresas do Google Maps automaticamente. Eles executam diariamente, encontrando novos prospects com base nos seus critérios e adicionando ao seu CRM.

## Visão Geral

Use Agentes Google Maps para:
- Encontrar empresas locais em áreas específicas
- Coletar informações de contato automaticamente
- Filtrar leads por métricas de qualidade
- Disparar ativação por Email ou WhatsApp

## Como Funciona

```
Configurar Busca → Execução Diária → Coleta de Leads → Inserção no CRM → Ativação
```

1. **Configurar**: Defina localização, tipo de negócio e filtros
2. **Executar**: Agente roda diariamente no horário definido
3. **Coletar**: Obtém dados (nome, telefone, email, avaliações)
4. **Inserir**: Adiciona leads qualificados ao seu CRM
5. **Ativar**: Opcionalmente dispara campanhas Email/WhatsApp

## Criando um Agente Google Maps

Navegue até **Google Maps** → **Criar Campanha**.

### Etapa 1: Nome da Configuração

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| Nome | Sim | Nome descritivo (ex: "Academias em São Paulo") |

### Etapa 2: Seleção de Localização

Defina onde buscar empresas.

**Formas de definir localização:**
- **Pesquisar**: Digite uma cidade ou endereço
- **Link do Google Maps**: Cole um link do Google Maps
- **Clique no Mapa**: Clique diretamente no mapa interativo
- **Ajustar Raio**: Arraste o círculo para mudar a área de busca

| Campo | Descrição |
|-------|-----------|
| Localização | Cidade, endereço ou link do Google Maps |
| Coordenadas | Preenchidas automaticamente da busca |
| Raio | Raio de busca em quilômetros |

### Etapa 3: Nicho do Negócio

Defina quais tipos de empresas encontrar.

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| Categoria | Um obrigatório | Categoria predefinida de negócio |
| Especificação | Um obrigatório | Descrição customizada do tipo de negócio |

::: info
Você deve preencher pelo menos um: Categoria OU Especificação
:::

**Exemplo de Especificação:**
```
nutricionistas, personal trainers, academias crossfit
```

### Etapa 4: Filtros de Qualificação

Filtre resultados para obter leads de maior qualidade.

| Filtro | Opções | Descrição |
|--------|--------|-----------|
| Avaliação Mínima | 3.0 - 4.5 estrelas | Apenas empresas com esta avaliação ou superior |
| Mínimo de Avaliações | 10, 20, 50, 100+ | Apenas empresas com avaliações suficientes |
| Exigir Telefone | Sim/Não | Deve ter telefone listado |
| Exigir Email | Sim/Não | Deve ter email listado |

::: warning
Filtros mais rigorosos = menos leads mas de maior qualidade. Equilibre com base no seu mercado.
:::

### Etapa 5: Ativação de Leads

Configure o que acontece com os leads coletados.

**Integração CRM (Sempre Ativo)**
- Todos os leads são automaticamente adicionados ao seu CRM
- Detecção de duplicatas previne re-adicionar contatos existentes

**Ativação por Email (Opcional)**

| Campo | Descrição |
|-------|-----------|
| Ativar por Email | Toggle para ativar |
| Agente de Email | Selecione um Agente de Ativação (tipo Email) |

**Ativação por WhatsApp (Opcional)**

| Campo | Descrição |
|-------|-----------|
| Ativar por WhatsApp | Toggle para ativar |
| Agente de WhatsApp | Selecione um Agente de Ativação (tipo WhatsApp) |

## Dados Coletados dos Leads

Cada lead inclui:

| Campo | Descrição |
|-------|-----------|
| Nome da Empresa | Nome do negócio |
| Telefone | Número de telefone (se disponível) |
| Email | Endereço de email (se disponível) |
| Endereço | Endereço completo |
| Website | Site da empresa |
| Avaliação | Avaliação do Google (1-5 estrelas) |
| Número de Avaliações | Quantidade de avaliações |
| Categoria | Categoria do negócio |
| Link Google Maps | Link direto para o listing |

## Status do Agente

| Status | Descrição |
|--------|-----------|
| Ativo | Executando diariamente conforme agendado |
| Pausado | Temporariamente parado |
| Concluído | Terminou todos os resultados disponíveis |
| Falhou | Erro ocorreu, precisa de atenção |

## Gerenciando Agentes

### Ver Estatísticas
Clique no card do agente para ver:
- Total de leads encontrados
- Leads inseridos no CRM
- Leads pulados (duplicatas)
- Ativações Email/WhatsApp pendentes

### Pausar Agente
1. Clique no botão pausar
2. Agente para a execução diária
3. Pode ser retomado a qualquer momento

### Deletar Agente
1. Clique no botão deletar
2. Confirme a exclusão
3. Leads coletados permanecem no CRM

## Melhores Práticas

### Seleção de Localização
- Comece com áreas específicas
- Use raio razoável (5-20 km)
- Evite agentes sobrepostos

### Filtros de Qualidade
- Exija telefone para cold calling
- Exija email para campanhas de email
- Avaliações mais altas = melhores empresas

### Estratégia de Ativação
- Não ative todos os canais de uma vez
- Teste um canal primeiro
- Personalize as mensagens de ativação
