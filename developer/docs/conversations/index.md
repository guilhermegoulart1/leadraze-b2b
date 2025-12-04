# Conversations

Conversations is your unified inbox for all lead communications across Email, WhatsApp, and LinkedIn. Manage all interactions in one place.

## Overview

The Conversations module provides:
- Unified inbox across all channels
- Real-time message updates
- AI agent conversation tracking
- Manual takeover capability
- Team assignment and collaboration
- Conversation status management

## Accessing Conversations

Navigate to **CRM** → **Conversations** in the sidebar.

## Interface Layout

The Conversations page has three main sections:

### 1. Sidebar (Left)
- Filter buttons
- Conversation list
- Search bar
- Unread indicators

### 2. Chat Area (Center)
- Message history
- Message composer
- Conversation context

### 3. Details Panel (Right)
- Contact information
- Lead details
- Tags and status
- Quick actions

## Conversation List

### Filtering Conversations

Quick filter buttons:

| Filter | Description |
|--------|-------------|
| Mine | Assigned to you |
| All | All conversations |
| Unassigned | No assignee |
| Closed | Completed conversations |

### Advanced Filters

Click the filter icon for more options:

| Filter | Options |
|--------|---------|
| Campaign | Filter by campaign source |
| Tags | Filter by conversation tags |
| Mode | All, AI-handled, Manual |
| Time Period | Today, Week, Month, All |

### Conversation Card

Each conversation shows:

| Element | Description |
|---------|-------------|
| Avatar | Contact profile picture |
| Name | Contact name |
| Preview | Last message preview |
| Time | Last activity timestamp |
| Channel Icon | LinkedIn, Email, or WhatsApp |
| Unread Badge | Count of unread messages |
| AI Indicator | Shows if AI is handling |

## Chat Area

### Message Display

Messages are shown chronologically with:
- Sender identification (Lead, AI, You)
- Timestamp
- Read status (for applicable channels)
- Channel indicator

### Message Types

| Type | Appearance |
|------|------------|
| Incoming | Left-aligned, different background |
| Outgoing (AI) | Right-aligned, AI indicator |
| Outgoing (Manual) | Right-aligned, your name |

### Composing Messages

The composer at the bottom allows:
- Text input
- Variable insertion
- Send button

::: tip
Messages sent here are delivered to the lead via their original channel.
:::

## Taking Over from AI

When an AI agent is handling a conversation:

### Switch to Manual

1. Open the conversation
2. Click **Take Over** or **Pause AI**
3. AI stops responding
4. You handle manually

### When to Take Over

- Complex questions beyond AI capability
- High-value leads needing personal touch
- Escalated conversations
- Final sales discussions

### Returning to AI

After manual handling:

1. Click **Resume AI**
2. AI takes over again
3. Continues based on context

## Details Panel

### Contact Information

| Field | Description |
|-------|-------------|
| Name | Full name |
| Email | Email address |
| Phone | Phone number |
| Company | Company name |
| Title | Job title |

### Conversation Details

| Field | Description |
|-------|-------------|
| Channel | Communication channel |
| Status | Open, Closed, Pending |
| Assigned To | Team member assigned |
| AI Mode | AI Active, Paused, Manual |
| Campaign | Source campaign |

### Quick Actions

| Action | Description |
|--------|-------------|
| View Lead | Open lead details |
| Assign | Change assignee |
| Add Tags | Apply tags |
| Close | Mark as closed |

## Conversation Status

### Status Types

| Status | Description |
|--------|-------------|
| Open | Active, needs attention |
| Pending | Waiting for response |
| Closed | Completed |

### Closing Conversations

Close when:
- Issue resolved
- Lead qualified and handed off
- Lead not interested
- Spam or invalid

To close:
1. Click **Close** in details panel
2. Or select status dropdown
3. Choose "Closed"

## Team Collaboration

### Assigning Conversations

1. Open conversation
2. Click assignee dropdown
3. Select team member
4. Notification sent to assignee

### Mentioning Team Members

In the message composer:
- Type `@` followed by name
- Select from dropdown
- Team member is notified

::: info
Mentions are internal - the lead doesn't see them.
:::

## AI Conversation Mode

### AI Active

- AI agent handles all responses
- Responses appear in real-time
- Lead sees AI replies immediately

### AI Paused

- AI stops responding
- Human agent expected to respond
- Can be resumed anytime

### Manual Only

- No AI involvement
- All responses are manual
- Set in conversation settings

### Viewing AI Reasoning

For AI-handled messages:
- Click the AI indicator
- See why AI responded that way
- Review intent detection

## Search and Find

### Search Conversations

Use the search bar to find by:
- Contact name
- Company name
- Message content
- Email address

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus search |
| `↑↓` | Navigate list |
| `Enter` | Open conversation |
| `Esc` | Clear search |

## Notifications

### Real-time Updates

The inbox updates automatically:
- New messages appear instantly
- Unread counts update
- Status changes reflect immediately

### Notification Settings

Configure in **Settings** → **Notifications**:
- Email notifications for new messages
- Browser notifications
- Mobile push notifications

## Best Practices

### Response Time
- Respond within 24 hours
- Prioritize unread conversations
- Set up AI for off-hours

### Message Quality
- Be helpful and professional
- Reference previous context
- Provide clear next steps

### Organization
- Use tags consistently
- Close resolved conversations
- Assign appropriately

### AI Utilization
- Let AI handle routine queries
- Take over for complex situations
- Train AI with feedback

## Conversation Metrics

Track performance in Analytics:

| Metric | Description |
|--------|-------------|
| Response Time | Average time to first response |
| Resolution Rate | Conversations resolved |
| AI vs Manual | Percentage handled by AI |
| Satisfaction | Lead satisfaction (if captured) |

## Troubleshooting

### Messages not appearing
- Refresh the page
- Check channel connection
- Verify conversation filter
- Check for sync delays

### Can't send messages
- Verify channel is connected
- Check for message limits
- Review channel health
- Check input for errors

### AI not responding
- Verify AI mode is active
- Check agent configuration
- Review escalation rules
- Verify knowledge base

### Conversation missing
- Check all filters (not just "Mine")
- Search by contact name
- Check if conversation is closed
- Verify lead exists

## Related Features

- [AI Agents](../ai-agents/) - Configure AI responses
- [Leads](../leads/) - Lead management
- [Campaigns](../campaigns/) - Campaign tracking
- [Channels](../channels/) - Channel setup
