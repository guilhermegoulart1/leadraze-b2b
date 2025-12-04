# Create Opportunity

<Badge type="info" text="POST" /> `/external/v1/opportunities`

Creates a new opportunity/lead in your pipeline.

## Authentication

Requires `opportunities:write` permission.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Full name of the lead |
| `email` | string | No | Email address |
| `phone` | string | No | Phone number with country code |
| `company` | string | No | Company name |
| `position` | string | No | Job title/position |
| `status` | string | No | Initial status (default: "new") |
| `source` | string | No | Lead source (default: "other") |
| `deal_value` | number | No | Estimated deal value |
| `deal_currency` | string | No | Currency code (default: "BRL") |
| `linkedin_url` | string | No | LinkedIn profile URL |
| `notes` | string | No | Additional notes |
| `responsible_user_id` | string | No | Assign to specific user |

### Available Sources

- `linkedin` - LinkedIn prospecting
- `google_maps` - Google Maps agent
- `list` - Imported list
- `paid_traffic` - Paid advertising
- `other` - Other sources

## Request

::: code-group

```bash [cURL]
curl --request POST \
  --url "https://app.getraze.com/external/v1/opportunities" \
  --header "Content-Type: application/json" \
  --header "X-API-Key: YOUR_API_KEY" \
  --data '{
    "name": "Jane Smith",
    "email": "jane@company.com",
    "company": "Tech Corp",
    "position": "CTO",
    "source": "paid_traffic",
    "deal_value": 75000,
    "deal_currency": "BRL",
    "notes": "Inbound from Google Ads"
  }'
```

```javascript [Node.js]
const axios = require('axios');

const response = await axios.post(
  'https://app.getraze.com/external/v1/opportunities',
  {
    name: 'Jane Smith',
    email: 'jane@company.com',
    company: 'Tech Corp',
    position: 'CTO',
    source: 'paid_traffic',
    deal_value: 75000,
    deal_currency: 'BRL',
    notes: 'Inbound from Google Ads'
  },
  {
    headers: {
      'X-API-Key': 'YOUR_API_KEY',
      'Content-Type': 'application/json'
    }
  }
);

console.log(response.data);
```

```python [Python]
import requests

response = requests.post(
    'https://app.getraze.com/external/v1/opportunities',
    headers={
        'X-API-Key': 'YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'name': 'Jane Smith',
        'email': 'jane@company.com',
        'company': 'Tech Corp',
        'position': 'CTO',
        'source': 'paid_traffic',
        'deal_value': 75000,
        'deal_currency': 'BRL',
        'notes': 'Inbound from Google Ads'
    }
)

print(response.json())
```

:::

## Response

```json
{
  "success": true,
  "data": {
    "id": "opp_xyz789abc123",
    "name": "Jane Smith",
    "email": "jane@company.com",
    "company": "Tech Corp",
    "position": "CTO",
    "status": "new",
    "source": "paid_traffic",
    "deal_value": 75000.00,
    "deal_currency": "BRL",
    "notes": "Inbound from Google Ads",
    "created_at": "2024-01-25T09:00:00Z"
  }
}
```

## Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Required fields missing or invalid |
| 400 | `INVALID_SOURCE` | Invalid source value |
| 400 | `INVALID_STATUS` | Invalid status value |
