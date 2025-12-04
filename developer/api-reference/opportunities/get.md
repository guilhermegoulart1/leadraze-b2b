# Get Opportunity

<Badge type="tip" text="GET" /> `/external/v1/opportunities/:id`

Retrieves details of a specific opportunity/lead by ID.

## Authentication

Requires `opportunities:read` permission.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The unique identifier of the opportunity |

## Request

::: code-group

```bash [cURL]
curl --request GET \
  --url "https://app.getraze.com/external/v1/opportunities/opp_abc123def456" \
  --header "X-API-Key: YOUR_API_KEY"
```

```javascript [Node.js]
const axios = require('axios');

const opportunityId = 'opp_abc123def456';

const response = await axios.get(
  `https://app.getraze.com/external/v1/opportunities/${opportunityId}`,
  {
    headers: {
      'X-API-Key': 'YOUR_API_KEY'
    }
  }
);

console.log(response.data);
```

```python [Python]
import requests

opportunity_id = 'opp_abc123def456'

response = requests.get(
    f'https://app.getraze.com/external/v1/opportunities/{opportunity_id}',
    headers={'X-API-Key': 'YOUR_API_KEY'}
)

print(response.json())
```

:::

## Response

```json
{
  "success": true,
  "data": {
    "id": "opp_abc123def456",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+5511999999999",
    "company": "Acme Inc",
    "position": "CEO",
    "status": "qualified",
    "source": "linkedin",
    "deal_value": 50000.00,
    "deal_currency": "BRL",
    "linkedin_url": "https://linkedin.com/in/johndoe",
    "notes": "Interested in enterprise plan",
    "campaign": {
      "id": "camp_xyz789",
      "name": "Q1 Outreach"
    },
    "responsible_user": {
      "id": "usr_123",
      "name": "Sales Rep"
    },
    "won_at": null,
    "lost_at": null,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-20T14:00:00Z"
  }
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique opportunity identifier |
| `name` | string | Lead's full name |
| `email` | string | Email address |
| `phone` | string | Phone number |
| `company` | string | Company name |
| `position` | string | Job title |
| `status` | string | Pipeline status |
| `source` | string | Lead source |
| `deal_value` | number | Deal value |
| `deal_currency` | string | Currency code |
| `notes` | string | Additional notes |
| `campaign` | object | Associated campaign info |
| `responsible_user` | object | Assigned user info |
| `won_at` | string | Timestamp when marked as won |
| `lost_at` | string | Timestamp when marked as lost |

## Errors

| Status | Code | Description |
|--------|------|-------------|
| 404 | `NOT_FOUND` | Opportunity not found |
