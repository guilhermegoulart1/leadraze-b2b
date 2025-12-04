# Activation Agents

Activation Agents are designed for outreach campaigns across Email, WhatsApp, and LinkedIn. They send personalized messages to your contact lists and handle initial engagement.

## Overview

Use Activation Agents to:
- Launch multi-channel outreach campaigns
- Send personalized messages at scale
- Follow up with leads automatically
- Maintain consistent communication tone

## Supported Channels

| Channel | Description | Best For |
|---------|-------------|----------|
| **Email** | Professional email outreach | B2B communication, formal outreach |
| **WhatsApp** | Direct messaging | Quick responses, informal markets |
| **LinkedIn** | Professional networking | B2B sales, professional services |

## Creating an Activation Agent

Navigate to **Activation Agents** → **Create Agent** to start the wizard.

### Step 1: Agent Identity

Define who your agent is.

| Field | Required | Description |
|-------|----------|-------------|
| Name | Yes | Agent name (e.g., "Sales Outreach Agent") |
| Description | No | What this agent does |
| Avatar | Auto | Automatically generated, can be refreshed |

::: tip
Use descriptive names to easily identify agents when creating campaigns.
:::

### Step 2: Activation Type

Choose the communication channel.

| Type | Icon | Description |
|------|------|-------------|
| Email | 📧 | Send emails through connected email accounts |
| WhatsApp | 💬 | Send WhatsApp messages |
| LinkedIn | 💼 | Send LinkedIn messages |

::: warning
You can only select one channel per agent. Create multiple agents for multi-channel campaigns.
:::

### Step 3: Communication Style

Configure how your agent communicates.

| Field | Options | Description |
|-------|---------|-------------|
| Tone | Formal, Casual, Professional, Friendly | Communication style |
| Language | Portuguese, English, Spanish | Message language |
| Personality | Free text | Personality description |

**Tone Examples:**

| Tone | Example Opening |
|------|-----------------|
| Formal | "Dear Mr. Smith, I hope this message finds you well." |
| Casual | "Hey John! Quick question for you." |
| Professional | "Hi John, I noticed your company is growing rapidly." |
| Friendly | "Hi John! 👋 Hope you're having a great week!" |

### Step 4: Messages

Define the messages your agent will send.

| Field | Required | Description |
|-------|----------|-------------|
| Initial Message | Yes | First outreach message |
| Follow-up Message | No | Message sent if no response |
| Custom Instructions | No | Special instructions for the agent |

**Example Initial Message (Email):**
```
Subject: Quick question about {{company}}'s lead generation

Hi {{name}},

I came across {{company}} and was impressed by what you're building
in the {{industry}} space.

I'm reaching out because we've helped similar companies increase
their qualified leads by 3x through AI-powered automation.

Would you be open to a 15-minute call to explore if this could
work for {{company}}?

Best regards,
[Your Name]
```

**Example Follow-up Message:**
```
Hi {{name}},

Just following up on my previous message. I understand you're busy,
but I'd love to share how we've helped companies like {{company}}
streamline their lead generation.

Would next week work for a quick chat?

Best,
[Your Name]
```

### Step 5: Review & Create

Review all settings before creating your agent:
- Agent identity (name, avatar)
- Channel selection
- Communication style
- Message templates

## Using Variables

Personalize messages with these variables:

| Variable | Description |
|----------|-------------|
| `{{name}}` | Contact's name |
| `{{company}}` | Company name |
| `{{title}}` | Job title |
| `{{industry}}` | Industry |
| `{{location}}` | Location |

## Assigning to Campaigns

After creating an Activation Agent:

1. Go to **Activation Campaigns**
2. Create or edit a campaign
3. Select your agent in the agent dropdown
4. Configure campaign schedule
5. Launch the campaign

## Agent Statistics

Track performance on the agent card:

| Metric | Description |
|--------|-------------|
| Campaigns | Number of campaigns using this agent |
| Active Campaigns | Currently running campaigns |
| Messages Sent | Total messages delivered |
| Response Rate | Percentage of responses received |

## Managing Agents

### Edit Agent
1. Click the edit icon on the agent card
2. Modify settings
3. Save changes

::: info
Changes apply to future messages only. Active campaigns continue with current settings.
:::

### Deactivate Agent
1. Toggle the active switch off
2. Agent won't be available for new campaigns

### Delete Agent
1. Click the delete icon
2. Confirm deletion

::: warning
You cannot delete agents that are assigned to active campaigns. Pause or complete campaigns first.
:::

## Best Practices

### Message Writing
- Keep initial messages short (under 150 words)
- Focus on value, not features
- Ask a clear question
- Personalize with variables

### Tone Selection
- Match your brand voice
- Consider your audience
- Test different tones

### Follow-up Strategy
- Wait 3-5 days before follow-up
- Reference previous message
- Add new value or angle
- Limit to 2-3 follow-ups

## Channel-Specific Tips

### Email
- Use clear subject lines
- Keep formatting simple
- Include a clear CTA
- Avoid spam triggers

### WhatsApp
- Be concise
- Use conversational tone
- Respect time zones
- Don't overuse emojis

### LinkedIn
- Reference profile details
- Be professional
- Mention mutual connections
- Keep messages brief

## Troubleshooting

### Messages not sending
- Verify channel is connected
- Check campaign status
- Review daily limits

### Low response rates
- Test different messages
- Adjust tone
- Improve personalization
- Review target audience

### Agent not available in campaigns
- Check if agent is active
- Verify agent type matches campaign channel
