# Activation Campaigns

Activation Campaigns send automated outreach to your existing contacts through Email, WhatsApp, or LinkedIn.

## Overview

Activation Campaigns are for:
- Reaching contacts you already have
- Multi-channel outreach sequences
- Following up with leads
- Re-engaging dormant contacts
- Mass communication campaigns

## vs LinkedIn Campaigns

| Aspect | LinkedIn Campaign | Activation Campaign |
|--------|-------------------|---------------------|
| Target | Search for new profiles | Existing contacts |
| Channels | LinkedIn only | Email, WhatsApp, LinkedIn |
| Source | LinkedIn search | Contact Lists |
| Purpose | Discovery | Outreach |

## Creating a Campaign

Navigate to **Activation** → **Campaigns** → **Create Campaign**.

### Campaign Wizard

The wizard has 4 steps:

## Step 1: Campaign Basics

| Field | Required | Description |
|-------|----------|-------------|
| Name | Yes | Campaign name |
| Description | No | Campaign purpose |

## Step 2: Target Audience

Select your target contacts:

### Contact List Selection

1. Choose an existing Contact List
2. Or create a new list
3. Review contact count

| Info Shown | Description |
|------------|-------------|
| List Name | Selected list |
| Contact Count | Total contacts |
| Valid for Channel | Contacts with required info |

::: tip
For email campaigns, only contacts with email addresses will be reached. Same for phone/WhatsApp.
:::

## Step 3: Channel & Agent

### Select Channel

| Channel | Requirements | Best For |
|---------|-------------|----------|
| Email | Contact has email | Formal outreach, detailed info |
| WhatsApp | Contact has phone | Quick engagement, informal |
| LinkedIn | Contact has LinkedIn | Professional, B2B |

### Select Activation Agent

Choose an Activation Agent for this campaign:

1. View available agents for the selected channel
2. Preview agent configuration
3. Select the agent

::: info
Create Activation Agents in **AI Agents** before creating campaigns.
:::

### Agent Preview

When selecting an agent, you'll see:
- Agent name and avatar
- Message templates
- Tone and language settings

## Step 4: Schedule & Review

### Scheduling Options

| Option | Description |
|--------|-------------|
| Start Immediately | Launch right after creation |
| Schedule for Later | Set future start date/time |
| Daily Limits | Max contacts per day |

### Review Checklist

Before launching, verify:
- [ ] Target list has sufficient contacts
- [ ] Contacts have required data (email/phone)
- [ ] Agent is configured correctly
- [ ] Messages are personalized
- [ ] Schedule is appropriate

## Campaign Execution

### Execution Flow

```
Campaign Starts → Contacts Queued → Messages Sent → Responses Tracked
```

1. **Queue**: Contacts are queued for outreach
2. **Send**: Messages sent within daily limits
3. **Track**: Delivery and responses monitored
4. **Update**: Lead status updated

### Delivery Pacing

Messages are spaced throughout the day to:
- Appear more natural
- Respect rate limits
- Improve deliverability
- Avoid triggering spam filters

## Managing Campaigns

### Campaign Dashboard

View all campaigns with:
- Status badges
- Progress indicators
- Key metrics
- Quick actions

### Campaign Actions

| Action | When Available | Effect |
|--------|----------------|--------|
| Pause | Active campaigns | Stops sending |
| Resume | Paused campaigns | Continues sending |
| Edit | Draft/Paused | Modify settings |
| Delete | Any status | Removes campaign |
| Clone | Any status | Creates copy |

### Campaign Status Flow

```
Draft → Scheduled → Active → Completed
                  ↓
               Paused → Resume → Active
```

## Campaign Statistics

### Metrics Tracked

| Metric | Description |
|--------|-------------|
| Total Contacts | Contacts in target list |
| Queued | Waiting to be sent |
| Sent | Successfully delivered |
| Delivered | Confirmed receipt |
| Opened | Emails opened (email only) |
| Clicked | Links clicked (email only) |
| Responded | Replies received |
| Failed | Delivery failed |

### Performance Indicators

**Email Campaigns:**
| Metric | Good | Average | Needs Work |
|--------|------|---------|------------|
| Open Rate | >40% | 20-40% | <20% |
| Click Rate | >5% | 2-5% | <2% |
| Response Rate | >10% | 5-10% | <5% |

**WhatsApp Campaigns:**
| Metric | Good | Average | Needs Work |
|--------|------|---------|------------|
| Delivery Rate | >95% | 85-95% | <85% |
| Read Rate | >70% | 50-70% | <50% |
| Response Rate | >20% | 10-20% | <10% |

## Multi-Channel Campaigns

### Strategy: Sequential Channels

1. Start with Email
2. Follow up on WhatsApp (no response)
3. Final attempt on LinkedIn

### Implementation

Create separate campaigns:
1. Email campaign to full list
2. Wait for results
3. WhatsApp campaign to non-responders
4. LinkedIn campaign to remaining

::: tip
Export non-responders from first campaign to create list for second campaign.
:::

## Follow-up Campaigns

### When to Follow Up

| Trigger | Action |
|---------|--------|
| No open after 3 days | Send follow-up email |
| Opened but no reply | WhatsApp follow-up |
| No response after 7 days | Different approach |

### Best Practices

- Change subject line (email)
- Adjust message angle
- Provide additional value
- Limit to 2-3 follow-ups

## Best Practices

### List Quality
- Clean data before campaign
- Verify email addresses
- Remove bounced contacts
- Update outdated info

### Message Optimization
- A/B test subject lines
- Personalize content
- Clear call-to-action
- Mobile-friendly format

### Timing
- Business hours preferred
- Consider time zones
- Avoid holidays
- Test different days

### Compliance
- Include unsubscribe option
- Honor opt-outs immediately
- Don't spam
- Respect frequency

## Troubleshooting

### Messages not sending
- Check campaign status
- Verify daily limits
- Review channel connection
- Check for errors in queue

### High bounce rate
- Clean your contact list
- Verify email addresses
- Check email reputation
- Review sending domain

### Low response rate
- Improve subject lines
- Make messages more personal
- Offer clear value
- Test different approaches

### Campaign stuck on "Sending"
- Check daily limit usage
- Verify channel is connected
- Review for processing errors
- Contact support if persists

## Related Features

- [Activation Agents](../ai-agents/activation-agents) - Configure outreach
- [Contact Lists](../leads/contact-lists) - Build target lists
- [Channels](../channels/) - Connect channels
- [Conversations](../conversations/) - Manage responses
