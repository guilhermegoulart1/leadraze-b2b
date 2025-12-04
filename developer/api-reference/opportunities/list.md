# List Opportunities

<Badge type="tip" text="GET" /> `/external/v1/opportunities`

Returns a paginated list of all opportunities/leads in your pipeline.

## Authentication

Requires `opportunities:read` permission.

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number for pagination |
| `limit` | integer | 20 | Items per page (1-100) |
| `search` | string | - | Search by name, email, or company |
| `status` | string | - | Filter by status |
| `source` | string | - | Filter by source (linkedin, google_maps, list, paid_traffic, other) |
| `campaign_id` | string | - | Filter by campaign ID |
| `responsible_user_id` | string | - | Filter by assigned user ID |
| `sort_by` | string | created_at | Sort field |
| `sort_order` | string | desc | Sort order (asc, desc) |

### Available Status Values

- `new` - New lead
- `contacted` - First contact made
- `qualified` - Lead qualified
- `proposal` - Proposal sent
- `negotiation` - In negotiation
- `won` - Deal won
- `lost` - Deal lost

## Request

::: code-group

```bash [cURL]
curl --request GET \
  --url "https://app.getraze.com/external/v1/opportunities?status=qualified&limit=50" \
  --header "X-API-Key: YOUR_API_KEY"
```

```javascript [Node.js]
const axios = require('axios');

const response = await axios.get('https://app.getraze.com/external/v1/opportunities', {
  headers: {
    'X-API-Key': 'YOUR_API_KEY'
  },
  params: {
    status: 'qualified',
    limit: 50
  }
});

console.log(response.data);
```

```python [Python]
import requests

response = requests.get(
    'https://app.getraze.com/external/v1/opportunities',
    headers={'X-API-Key': 'YOUR_API_KEY'},
    params={'status': 'qualified', 'limit': 50}
)

print(response.json())
```

:::

## Response

```json
{
  "success": true,
  "data": {
    "opportunities": [
      {
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
        "campaign_id": "camp_xyz789",
        "responsible_user_id": "usr_123",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-20T14:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 85,
      "total_pages": 2
    }
  }
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `opportunities` | array | List of opportunity objects |
| `id` | string | Unique opportunity identifier |
| `status` | string | Current pipeline status |
| `source` | string | Lead source |
| `deal_value` | number | Estimated or closed deal value |
| `deal_currency` | string | Currency code (BRL, USD, EUR) |
| `campaign_id` | string | Associated campaign ID |
| `responsible_user_id` | string | Assigned user ID |
| `pagination` | object | Pagination metadata |
