# Leads

Leads are the core of GetRaze. Manage your prospects through a visual pipeline, import contacts, and track every interaction.

## Overview

The Leads module provides:
- Visual Kanban pipeline for lead management
- Multiple views (Kanban, List, Grid)
- Advanced filtering and search
- Bulk operations
- Lead scoring and qualification
- Complete interaction history

## Accessing Leads

Navigate to **CRM** → **Leads** in the sidebar.

## Pipeline View

### Stages

The default pipeline has four stages:

| Stage | Color | Description |
|-------|-------|-------------|
| Prospect | 🔵 Blue | New leads, not yet qualified |
| Qualified | 🟡 Yellow | Leads that meet your criteria |
| Negotiation | 🟠 Orange | Active sales conversations |
| Won/Lost | 🟢/🔴 Green/Red | Closed deals (won or lost) |

### Moving Leads

Drag and drop leads between stages to update their status.

### Stage Counts

Each stage header shows:
- Number of leads in stage
- Total value (if applicable)

## Lead Card

Each lead card displays:

| Element | Description |
|---------|-------------|
| Avatar | Profile picture or initials |
| Name | Lead's full name |
| Company | Company name |
| Title | Job title |
| Tags | Applied tags |
| Score | Lead score (if enabled) |
| Last Activity | Most recent interaction |

### Opening Lead Details

Click on any lead card to open the detail modal.

## Lead Details

The detail modal shows comprehensive information:

### Overview Tab

| Field | Description |
|-------|-------------|
| Name | Full name |
| Email | Email address |
| Phone | Phone number |
| Company | Company name |
| Title | Job title |
| Location | Geographic location |
| Industry | Industry sector |
| Source | How the lead was added |
| Score | Lead qualification score |
| Status | Current pipeline stage |

### Activity Tab

View complete interaction history:
- Messages sent/received
- Status changes
- Notes added
- Assignments

### Notes Tab

Add internal notes about the lead:
- Meeting notes
- Research findings
- Strategy notes
- Team comments

## Views

### Kanban View
- Drag-and-drop pipeline
- Visual stage management
- Quick status updates
- Best for pipeline management

### List View
- Tabular format
- Sortable columns
- Bulk selection
- Best for data review

### Grid View
- Card-based layout
- More details visible
- Visual browsing
- Best for quick scanning

## Filtering Leads

### Quick Filters

| Filter | Description |
|--------|-------------|
| Status | Filter by pipeline stage |
| Source | Filter by lead source |
| Tags | Filter by applied tags |
| Assigned | Filter by assignee |

### Advanced Filters

Click **Advanced Filters** for more options:

| Filter | Description |
|--------|-------------|
| Date Range | Created or updated date |
| Score Range | Minimum/maximum score |
| Location | Geographic filter |
| Industry | Industry sector |
| Company Size | Employee count range |
| Custom Fields | Your custom field values |

### Search

Use the search bar to find leads by:
- Name
- Email
- Company
- Phone

### Active Filter Pills

Applied filters appear as pills below the search bar. Click the X to remove a filter.

## Bulk Operations

Select multiple leads for bulk actions:

1. Check the boxes on lead cards
2. Or use "Select All" option
3. Choose an action:

| Action | Description |
|--------|-------------|
| Change Status | Move to different stage |
| Assign | Assign to team member |
| Add Tags | Apply tags to selected |
| Export | Download as CSV |
| Delete | Remove selected leads |

## Adding Leads

### Manual Entry

1. Click **Add Lead**
2. Fill in the form:

| Field | Required | Description |
|-------|----------|-------------|
| Name | Yes | Full name |
| Email | Recommended | Email address |
| Phone | No | Phone number |
| Company | No | Company name |
| Title | No | Job title |
| Source | No | How you found this lead |

3. Click **Save**

### Import from CSV

See [Importing Leads](./importing) for detailed instructions.

### From Campaigns

Leads are automatically added when:
- LinkedIn campaigns collect profiles
- Google Maps agents find businesses
- Activation campaigns generate responses

## Lead Scoring

Lead scores help prioritize your pipeline.

### How Scores Work

Scores range from 0-100 based on:
- Profile completeness
- Engagement level
- Response rate
- Fit with ideal customer profile

### Score Indicators

| Score | Label | Color |
|-------|-------|-------|
| 80-100 | Hot | 🔴 Red |
| 60-79 | Warm | 🟠 Orange |
| 40-59 | Cool | 🟡 Yellow |
| 0-39 | Cold | 🔵 Blue |

## Tagging Leads

Tags help organize and segment leads.

### Adding Tags

1. Open lead details
2. Click the tags area
3. Type a tag name
4. Press Enter or select existing

### Common Tag Uses

- Industry: `tech`, `healthcare`, `finance`
- Size: `enterprise`, `mid-market`, `smb`
- Priority: `hot`, `follow-up`, `nurture`
- Source: `linkedin`, `referral`, `inbound`

## Assigning Leads

Assign leads to team members:

1. Open lead details
2. Click the Assigned field
3. Select a team member
4. Save changes

Or use bulk assignment for multiple leads.

## Lead Status

### Status Values

| Status | Meaning |
|--------|---------|
| New | Just added, not contacted |
| Contacted | First outreach sent |
| Engaged | Responded to outreach |
| Qualified | Meets qualification criteria |
| Proposal | Proposal/demo sent |
| Negotiation | Active sales conversation |
| Won | Deal closed successfully |
| Lost | Deal did not close |

### Updating Status

- Drag lead to new column (Kanban)
- Edit in detail modal
- Bulk update selected leads

## Best Practices

### Keep Data Clean
- Remove duplicates regularly
- Update outdated information
- Verify email addresses
- Complete missing fields

### Use Tags Consistently
- Define tag conventions
- Train team on usage
- Clean up unused tags

### Follow Up Promptly
- Respond within 24 hours
- Set follow-up reminders
- Don't let leads go cold

### Score Appropriately
- Define scoring criteria
- Review scores regularly
- Prioritize high-score leads

## Related Features

- [Importing Leads](./importing) - Bulk import from CSV
- [Contact Lists](./contact-lists) - Organize leads into lists
- [Campaigns](../campaigns/) - Automated outreach
- [Conversations](../conversations/) - Message history
