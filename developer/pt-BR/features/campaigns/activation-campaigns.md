# Campanhas de Ativação

Campanhas de Ativação enviam mensagens de primeiro contato via Email, WhatsApp ou LinkedIn usando Agentes de Ativação configurados.

## Visão Geral

Use Campanhas de Ativação para:
- Alcance em massa por email
- Mensagens WhatsApp personalizadas
- Abordagem LinkedIn direta
- Follow-ups automáticos

## Criando uma Campanha

1. Navegue até **Campanhas** → **Criar**
2. Selecione **Ativação**
3. Configure a campanha

### Configurações Básicas

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| Nome | Sim | Nome da campanha |
| Lista de Leads | Sim | Audiência alvo |
| Canal | Sim | Email, WhatsApp ou LinkedIn |
| Agente | Sim | Agente de Ativação correspondente |

### Configurações de Envio

| Campo | Descrição |
|-------|-----------|
| Limite Diário | Máximo de envios por dia |
| Horário de Envio | Quando enviar mensagens |
| Intervalo | Tempo entre envios |

## Canais de Ativação

### Email
- Use contas de email conectadas
- Rastreamento de abertura
- Personalização completa

### WhatsApp
- Via WhatsApp Business conectado
- Mensagens instantâneas
- Alta taxa de leitura

### LinkedIn
- Mensagens diretas
- Solicitações de conexão
- Integração com conversas

## Fluxo da Campanha

```
Lead → Mensagem Inicial → Aguarda Resposta → Follow-up (opcional) → Qualificação
```

## Métricas

| Métrica | Descrição |
|---------|-----------|
| Enviados | Total de mensagens enviadas |
| Entregues | Mensagens entregues com sucesso |
| Abertos | Emails abertos (só email) |
| Respondidos | Respostas recebidas |
| Qualificados | Leads qualificados |

## Gerenciando Campanhas

### Monitorar
- Acompanhe métricas em tempo real
- Verifique entregas
- Analise respostas

### Ajustar
- Modifique limites
- Altere horários
- Atualize mensagens (novas apenas)

### Pausar/Retomar
- Pause para ajustes
- Retome quando pronto

## Melhores Práticas

### Segmentação
- Separe leads por perfil
- Personalize por segmento
- Teste diferentes abordagens

### Mensagens
- Seja direto e claro
- Ofereça valor
- Inclua call-to-action

### Timing
- Respeite horário comercial
- Evite excesso de mensagens
- Espaçamento adequado

## Integração com Google Maps

Leads coletados por Agentes Google Maps podem ser automaticamente ativados:

1. Configure Agente Google Maps
2. Habilite ativação Email/WhatsApp
3. Leads novos recebem mensagens automaticamente

## Solução de Problemas

### Mensagens não enviando
1. Verifique canal conectado
2. Confirme limite não atingido
3. Verifique agente ativo

### Baixa entregabilidade (Email)
1. Verifique reputação do domínio
2. Revise conteúdo das mensagens
3. Aqueça a conta gradualmente

### Conta bloqueada (WhatsApp)
1. Pause campanhas
2. Aguarde liberação
3. Reduza volume
