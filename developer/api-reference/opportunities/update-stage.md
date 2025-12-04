# Update Opportunity Stage

<Badge type="warning" text="PATCH" /> `/external/v1/opportunities/:id/stage`

Updates only the status/stage of an opportunity in the pipeline.

## Authentication

Requires `opportunities:write` permission.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The unique identifier of the opportunity |

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | Yes | New pipeline status |

### Available Status Values

| Status | Description |
|--------|-------------|
| `new` | New lead, not yet contacted |
| `contacted` | First contact has been made |
| `qualified` | Lead has been qualified |
| `proposal` | Proposal has been sent |
| `negotiation` | In active negotiation |
| `won` | Deal closed successfully |
| `lost` | Deal lost |

::: info
When setting status to `won`, the `won_at` timestamp is automatically set.
When setting status to `lost`, the `lost_at` timestamp is automatically set.
:::

## Request

::: code-group

```bash [cURL]
curl --request PATCH \
  --url "https://app.getraze.com/external/v1/opportunities/opp_abc123def456/stage" \
  --header "Content-Type: application/json" \
  --header "X-API-Key: YOUR_API_KEY" \
  --data '{
    "status": "won"
  }'
```

```javascript [Node.js]
const axios = require('axios');

const opportunityId = 'opp_abc123def456';

const response = await axios.patch(
  `https://app.getraze.com/external/v1/opportunities/${opportunityId}/stage`,
  {
    status: 'won'
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

response = requests.patch(
    f'https://app.getraze.com/external/v1/opportunities/{opportunity_id}/stage',
    headers={
        'X-API-Key': 'YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'status': 'won'
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
    "status": "won",
    "won_at": "2024-01-25T10:00:00Z",
    "updated_at": "2024-01-25T10:00:00Z"
  }
}
```

## Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_STATUS` | Status value is not valid |
| 404 | `NOT_FOUND` | Opportunity not found |
