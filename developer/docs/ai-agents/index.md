# AI Agents

AI Agents automate conversations and outreach in GetRaze. Each agent type serves a specific purpose in your lead generation workflow.

## Agent Types

| Agent Type | Channel | Purpose |
|------------|---------|---------|
| [Conversation Agents](./conversation-agents) | LinkedIn | Automated LinkedIn conversation responses |
| [Activation Agents](./activation-agents) | Email, WhatsApp, LinkedIn | Outreach message sending |
| [Google Maps Agents](./google-maps-agents) | Google Maps → CRM | Business lead collection |

## Creating Agents

Navigate to **AI Agents** in the sidebar and click **Create Agent**.

### Common Fields

All agents share these initial fields:

| Field | Required | Description |
|-------|----------|-------------|
| Avatar | No | Auto-generated from pravatar.cc, can be refreshed |
| Name | Yes | Agent identifier (e.g., "Sales Agent LinkedIn") |
| Description | No | Purpose description |
| Agent Type | Yes | linkedin, email, or whatsapp |

### Response Length

Configure how verbose agent responses should be:

| Option | Label | Description |
|--------|-------|-------------|
| `short` | Curtas | 1-2 lines |
| `medium` | Médias | 2-4 lines (default) |
| `long` | Longas | 4-6 lines |

## Message Variables

Use these variables in messages for personalization:

| Variable | Description |
|----------|-------------|
| `{{nome}}` | Contact name |
| `{{empresa}}` | Company name |
| `{{cargo}}` | Job title |
| `{{localizacao}}` | Location |
| `{{industria}}` | Industry |
| `{{conexoes}}` | Connection count (LinkedIn) |
| `{{resumo}}` | Profile summary (LinkedIn) |
| `{{agente}}` | Agent name |

## Behavioral Profiles (LinkedIn Agents)

LinkedIn agents use behavioral profiles that define conversation style:

| Profile | Icon | Description |
|---------|------|-------------|
| `consultivo` | 🎯 | Asks questions, understands problems before offering solutions |
| `direto` | ⚡ | Direct, quick value presentation |
| `educativo` | 📚 | Shares insights and adds value before selling |
| `amigavel` | 😊 | Casual, personal connection approach |

## Escalation Rules

Configure when agents should transfer to a human:

| Rule | Description |
|------|-------------|
| Price questions | Transfer when lead asks about pricing |
| Technical questions | Transfer for technical inquiries |
| Max messages | Suggest human contact after N messages (5-50) |

## Testing Agents

Before deploying, test your agent:

1. Click the **Test** button on the agent card
2. Send a sample message
3. Review the agent's response
4. Adjust configuration if needed

## Next Steps

- [Create a Conversation Agent](./conversation-agents) for LinkedIn automation
- [Create an Activation Agent](./activation-agents) for outreach campaigns
- [Create a Google Maps Agent](./google-maps-agents) for lead collection
