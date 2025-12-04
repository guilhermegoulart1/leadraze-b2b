# List Contacts

<Badge type="tip" text="GET" /> `/external/v1/contacts`

Returns a paginated list of all contacts in your account.

## Authentication

Requires `contacts:read` permission.

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number for pagination |
| `limit` | integer | 20 | Items per page (1-100) |
| `search` | string | - | Search by name, email, or company |
| `company` | string | - | Filter by company name |
| `email` | string | - | Filter by email address |
| `source` | string | - | Filter by source (linkedin, google_maps, list) |
| `tags` | string | - | Filter by tags (comma-separated) |
| `sort_by` | string | created_at | Sort field |
| `sort_order` | string | desc | Sort order (asc, desc) |

## Request

::: code-group

```bash [cURL]
curl --request GET \
  --url "https://app.getraze.com/external/v1/contacts?page=1&limit=20" \
  --header "X-API-Key: YOUR_API_KEY"
```

```javascript [Node.js]
const axios = require('axios');

const response = await axios.get('https://app.getraze.com/external/v1/contacts', {
  headers: {
    'X-API-Key': 'YOUR_API_KEY'
  },
  params: {
    page: 1,
    limit: 20,
    search: 'john'
  }
});

console.log(response.data);
```

```python [Python]
import requests

response = requests.get(
    'https://app.getraze.com/external/v1/contacts',
    headers={'X-API-Key': 'YOUR_API_KEY'},
    params={'page': 1, 'limit': 20}
)

print(response.json())
```

:::

## Response

```json
{
  "success": true,
  "data": {
    "contacts": [
      {
        "id": "cnt_abc123def456",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+5511999999999",
        "company": "Acme Inc",
        "position": "CEO",
        "source": "linkedin",
        "linkedin_url": "https://linkedin.com/in/johndoe",
        "tags": ["prospect", "decision-maker"],
        "custom_fields": {},
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-20T14:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "total_pages": 8
    }
  }
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `contacts` | array | List of contact objects |
| `pagination.page` | integer | Current page number |
| `pagination.limit` | integer | Items per page |
| `pagination.total` | integer | Total number of contacts |
| `pagination.total_pages` | integer | Total number of pages |
