# Website Agents

Website Agents power the chat widget on your company website. They handle visitor inquiries, qualify leads, and provide 24/7 customer support.

## Overview

Website Agents provide:
- Real-time chat support on your website
- AI-powered responses using your knowledge base
- Lead capture and qualification
- Escalation to human agents when needed

## Pre-configured Agents

GetRaze includes two pre-configured website agents:

### Sales Agent
- **Purpose**: Handle sales inquiries from website visitors
- **Key**: `sales`
- **Default Message**: "Hi! I'm here to help you learn about our products and services."

### Support Agent
- **Purpose**: Provide technical support and answer questions
- **Key**: `support`
- **Default Message**: "Hi! I'm here to help with any technical questions."

## Agent Configuration

### Basic Settings

| Field | Description |
|-------|-------------|
| Name | Display name shown in chat widget |
| Avatar | Agent profile picture |
| Welcome Message | First message when chat opens |
| Personality | How the agent should behave |
| System Prompt | AI instructions (advanced) |

### Communication Settings

| Field | Options | Description |
|-------|---------|-------------|
| Tone | Professional, Friendly, Casual | Communication style |
| Response Length | Short, Medium, Long | How detailed responses should be |
| Language | en, pt-BR, es | Primary language |

## Knowledge Base

The knowledge base trains your agent to answer questions accurately.

### Knowledge Types

| Type | Icon | Use Case |
|------|------|----------|
| FAQ | ❓ | Common questions and answers |
| Product Info | 📦 | Product details and specifications |
| Pricing | 💰 | Pricing plans and options |
| Troubleshooting | 🔧 | Technical support solutions |
| General | 📝 | Company info, policies, etc. |

### Adding Knowledge Items

1. Navigate to **Website Agents** → **Knowledge Base**
2. Click **Add Item**
3. Fill in the fields:

| Field | Required | Description |
|-------|----------|-------------|
| Type | Yes | Category of knowledge |
| Question | For FAQ | The question being answered |
| Answer | For FAQ | The answer to provide |
| Content | For others | General knowledge content |
| Category | No | Topic classification |
| Tags | No | Search keywords |

**Example FAQ Item:**
```
Type: FAQ
Question: What are your pricing plans?
Answer: We offer three plans: Starter at $99/month, Professional
at $199/month, and Enterprise with custom pricing. All plans
include a 14-day free trial.
Category: Pricing
Tags: price, cost, plans, subscription
```

### Best Practices for Knowledge Base

1. **Be comprehensive** - Cover all common questions
2. **Use natural language** - Write as you would speak
3. **Keep updated** - Review and update regularly
4. **Add variations** - Include different phrasings
5. **Categorize properly** - Makes retrieval more accurate

## Chat Sessions

### Viewing Conversations

Navigate to **Website Agents** → **Conversations** to see:
- Active and past chat sessions
- Visitor information
- Message history
- Escalation status

### Session Information

| Field | Description |
|-------|-------------|
| Session ID | Unique identifier |
| Visitor IP | Visitor's IP address |
| Country | Detected country |
| Referrer | Where visitor came from |
| Messages | Total message count |
| Started | Session start time |
| Last Activity | Most recent message |

### Escalation

When the AI cannot handle a query:
1. Session is marked as "Escalated"
2. Notification sent to your team
3. Human agent can take over
4. Contact form may be shown to visitor

## Statistics

Track your website agents' performance:

| Metric | Description |
|--------|-------------|
| Total Sessions | Number of chat sessions |
| Messages | Total messages exchanged |
| Avg. Session Length | Average conversation duration |
| Escalation Rate | Percentage escalated to humans |
| Resolution Rate | Sessions resolved by AI |
| Response Time | Average AI response time |

## Integration

### Embedding the Chat Widget

Add the chat widget to your website:

```html
<!-- Add before closing </body> tag -->
<script src="https://app.getraze.co/widget.js"></script>
<script>
  GetRazeChat.init({
    accountId: 'YOUR_ACCOUNT_ID',
    agent: 'sales' // or 'support'
  });
</script>
```

### Widget Customization

```javascript
GetRazeChat.init({
  accountId: 'YOUR_ACCOUNT_ID',
  agent: 'sales',
  position: 'bottom-right', // or 'bottom-left'
  primaryColor: '#4F46E5',
  greeting: 'Need help? Chat with us!'
});
```

## Managing Agents

### Edit Agent Settings

1. Go to **Website Agents**
2. Click on the agent card
3. Modify settings
4. Save changes

### Toggle Agent Status

1. Find the agent in the list
2. Toggle the active switch
3. Inactive agents won't respond to chats

## Advanced Configuration

### System Prompt

The system prompt defines the AI's behavior. Default example:

```
You are a helpful sales assistant for [Company Name].
Your goal is to:
- Answer questions about our products and services
- Qualify leads by understanding their needs
- Schedule demos when appropriate
- Escalate complex technical questions to the team

Be professional, friendly, and concise.
```

### Escalation Rules

Configure automatic escalation for:
- Specific keywords ("refund", "complaint", "urgent")
- After N messages without resolution
- Specific question types
- Visitor requests human

## Best Practices

### For Sales Agent
- Focus on value proposition
- Ask qualifying questions
- Offer demos/meetings
- Capture contact information

### For Support Agent
- Provide step-by-step solutions
- Link to documentation
- Escalate complex issues
- Follow up on resolution

### General Tips
- Keep responses concise
- Use clear language
- Provide next steps
- Always offer human option

## Troubleshooting

### Widget not appearing
- Verify script is correctly installed
- Check account ID is correct
- Look for JavaScript errors in console

### Agent not responding
- Check if agent is active
- Verify knowledge base has content
- Review system prompt configuration

### Incorrect responses
- Add more knowledge base items
- Improve existing answers
- Review and refine system prompt

### High escalation rate
- Expand knowledge base coverage
- Add more FAQ items
- Adjust escalation thresholds
