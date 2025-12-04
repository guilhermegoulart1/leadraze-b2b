# Delete Opportunity

<Badge type="danger" text="DELETE" /> `/external/v1/opportunities/:id`

Permanently deletes an opportunity from your pipeline.

## Authentication

Requires `opportunities:delete` permission.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The unique identifier of the opportunity |

::: danger
This action is permanent and cannot be undone. The opportunity and all associated conversation history will be permanently deleted.
:::

## Request

::: code-group

```bash [cURL]
curl --request DELETE \
  --url "https://app.getraze.com/external/v1/opportunities/opp_abc123def456" \
  --header "X-API-Key: YOUR_API_KEY"
```

```javascript [Node.js]
const axios = require('axios');

const opportunityId = 'opp_abc123def456';

const response = await axios.delete(
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

response = requests.delete(
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
  "message": "Opportunity deleted successfully"
}
```

## Errors

| Status | Code | Description |
|--------|------|-------------|
| 404 | `NOT_FOUND` | Opportunity not found |
