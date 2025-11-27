# Google Maps Agents

Google Maps Agents automatically collect business leads from Google Maps searches. They run daily, finding new prospects based on your criteria and adding them to your CRM.

## Overview

Use Google Maps Agents to:
- Find local businesses in specific areas
- Collect contact information automatically
- Filter leads by quality metrics
- Trigger Email or WhatsApp outreach

## How It Works

```
Configure Search → Daily Execution → Lead Collection → CRM Insert → Activation
```

1. **Configure**: Set location, business type, and quality filters
2. **Execute**: Agent runs daily at your specified time
3. **Collect**: Gathers business data (name, phone, email, reviews)
4. **Insert**: Adds qualified leads to your CRM
5. **Activate**: Optionally triggers Email/WhatsApp campaigns

## Creating a Google Maps Agent

Navigate to **Google Maps** → **Agents** → **Create Agent**.

### Step 1: Agent Name

| Field | Required | Description |
|-------|----------|-------------|
| Name | Yes | Descriptive name (e.g., "Gyms in Miami") |

::: tip
Use names that describe the search to easily identify agents later.
:::

### Step 2: Location Selection

Define where to search for businesses.

| Field | Description |
|-------|-------------|
| Country | Select country (default: your country) |
| Location | City, address, or paste Google Maps link |
| Coordinates | Auto-filled from location search |
| Radius | Search radius in kilometers |

**Ways to set location:**
- **Search**: Type a city or address
- **Google Maps Link**: Paste a link from Google Maps
- **Map Click**: Click directly on the interactive map
- **Adjust Radius**: Drag the circle to change search area

### Step 3: Business Niche

Define what types of businesses to find.

| Field | Required | Description |
|-------|----------|-------------|
| Category | One required | Predefined business category |
| Specification | One required | Custom business type description |

**Available Categories:**
- Health & Wellness
- Technology
- Professional Services
- Food & Beverage
- Finance & Insurance
- Retail
- Education
- Real Estate
- Automotive
- Beauty & Personal Care

**Example Specification:**
```
personal trainers, fitness coaches, gym owners
```

::: info
You must fill at least one: Category OR Specification
:::

### Step 4: Lead Quality Filters

Filter results to get higher quality leads.

| Filter | Options | Description |
|--------|---------|-------------|
| Minimum Rating | 3.0 - 4.5 stars | Only businesses with this rating or higher |
| Minimum Reviews | 10, 20, 50, 100+ | Only businesses with enough reviews |
| Require Phone | Yes/No | Must have phone number listed |
| Require Email | Yes/No | Must have email address listed |

::: warning
Stricter filters = fewer but higher quality leads. Balance based on your market.
:::

### Step 5: Activation & Summary

Configure what happens with collected leads.

**CRM Integration (Always On)**
- All leads are automatically added to your CRM
- Duplicate detection prevents re-adding existing contacts

**Email Activation (Optional)**
| Field | Description |
|-------|-------------|
| Enable Email | Toggle to activate |
| Email Agent | Select an Activation Agent (Email type) |

**WhatsApp Activation (Optional)**
| Field | Description |
|-------|-------------|
| Enable WhatsApp | Toggle to activate |
| WhatsApp Agent | Select an Activation Agent (WhatsApp type) |

## Execution Schedule

| Setting | Default | Description |
|---------|---------|-------------|
| Daily Limit | 20 leads | Maximum leads per day |
| Execution Time | 09:00 | When the agent runs |

::: info
Agents run automatically every day at the configured time. Leads are collected in batches to stay within API limits.
:::

## Lead Data Collected

Each lead includes:

| Field | Description |
|-------|-------------|
| Business Name | Company name |
| Phone | Phone number (if available) |
| Email | Email address (if available) |
| Address | Full address |
| Website | Business website |
| Rating | Google rating (1-5 stars) |
| Reviews | Number of reviews |
| Category | Business category |
| Google Maps Link | Direct link to listing |

## Agent Status

| Status | Icon | Description |
|--------|------|-------------|
| Active | 🟢 | Running daily as scheduled |
| Paused | 🟡 | Temporarily stopped |
| Completed | ✅ | Finished all available results |
| Failed | 🔴 | Error occurred, needs attention |

## Managing Agents

### View Statistics
Click on an agent card to see:
- Total leads found
- Leads inserted to CRM
- Leads skipped (duplicates)
- Pending Email/WhatsApp activations
- API calls and estimated cost

### Pause Agent
1. Click the pause button
2. Agent stops daily execution
3. Can be resumed anytime

### Resume Agent
1. Click the resume button
2. Agent continues from where it stopped

### Delete Agent
1. Click the delete button
2. Confirm deletion
3. Collected leads remain in CRM

## Pagination & Daily Limits

Google Maps Agents work with pagination:

- Each execution fetches ~20 results
- Agent tracks progress with page markers
- Continues from last position next day
- Stops when all results are collected

**Example Timeline:**
```
Day 1: Fetch page 1 → 20 leads
Day 2: Fetch page 2 → 20 leads
Day 3: Fetch page 3 → 15 leads (done)
Status: Completed
```

## Cost Tracking

Google Maps searches use API credits:

| Metric | Description |
|--------|-------------|
| API Calls | Number of search requests made |
| Estimated Cost | Cost based on $0.00275 per call |

::: tip
Monitor your usage in the agent statistics to manage costs effectively.
:::

## Multi-Channel Activation

Combine Google Maps Agents with Activation Agents:

1. **Create Activation Agents** for Email and/or WhatsApp
2. **Configure Google Maps Agent** with activation enabled
3. **Leads flow automatically**:
   - Collected → CRM
   - CRM → Email campaign
   - CRM → WhatsApp campaign

## Best Practices

### Location Selection
- Start with specific areas
- Use reasonable radius (5-20 km)
- Avoid overlapping agents

### Quality Filters
- Require phone for cold calling
- Require email for email campaigns
- Higher ratings = better businesses

### Activation Strategy
- Don't activate all channels at once
- Test one channel first
- Personalize activation messages

## Troubleshooting

### No leads found
- Expand search radius
- Broaden business category
- Reduce quality filter strictness
- Check if location is correct

### Too many duplicates
- Agent is re-finding same businesses
- Consider a new location
- Mark agent as completed

### Activation not working
- Verify Activation Agent is active
- Check channel connection
- Review daily limits

### Agent stuck on "Running"
- Refresh the page
- Check for API errors
- Contact support if persists
