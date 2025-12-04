# Update Opportunity

<Badge type="warning" text="PUT" /> `/external/v1/opportunities/:id`

Updates an existing opportunity. Only provided fields will be updated.

## Authentication

Requires `opportunities:write` permission.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The unique identifier of the opportunity |

## Request Body

All fields are optional. Only include fields you want to update.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Full name |
| `email` | string | Email address |
| `phone` | string | Phone number |
| `company` | string | Company name |
| `position` | string | Job title |
| `deal_value` | number | Deal value |
| `deal_currency` | string | Currency code |
| `notes` | string | Additional notes |
| `responsible_user_id` | string | Assigned user ID |

::: tip
To update the opportunity status/stage, use the [Update Stage](/api-reference/opportunities/update-stage) endpoint instead.
:::

## Request

::: code-group

```bash [cURL]
curl --request PUT \
  --url "https://app.getraze.com/external/v1/opportunities/opp_abc123def456" \
  --header "Content-Type: application/json" \
  --header "X-API-Key: YOUR_API_KEY" \
  --data '{
    "deal_value": 100000,
    "notes": "Upgraded to enterprise package"
  }'
```

```javascript [Node.js]
const axios = require('axios');

const opportunityId = 'opp_abc123def456';

const response = await axios.put(
  `https://app.getraze.com/external/v1/opportunities/${opportunityId}`,
  {
    deal_value: 100000,
    notes: 'Upgraded to enterprise package'
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

opportunity_id = 'opp_abc123def456'

response = requests.put(
    f'https://app.getraze.com/external/v1/opportunities/{opportunity_id}',
    headers={
        'X-API-Key': 'YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'deal_value': 100000,
        'notes': 'Upgraded to enterprise package'
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
    "id": "opp_abc123def456",
    "name": "John Doe",
    "email": "john@example.com",
    "company": "Acme Inc",
    "status": "qualified",
    "deal_value": 100000.00,
    "deal_currency": "BRL",
    "notes": "Upgraded to enterprise package",
    "updated_at": "2024-01-25T10:00:00Z"
  }
}
```

## Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid field values |
| 404 | `NOT_FOUND` | Opportunity not found |
