# Get Contact

<Badge type="tip" text="GET" /> `/external/v1/contacts/:id`

Retrieves details of a specific contact by ID.

## Authentication

Requires `contacts:read` permission.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The unique identifier of the contact |

## Request

::: code-group

```bash [cURL]
curl --request GET \
  --url "https://app.getraze.com/external/v1/contacts/cnt_abc123def456" \
  --header "X-API-Key: YOUR_API_KEY"
```

```javascript [Node.js]
const axios = require('axios');

const contactId = 'cnt_abc123def456';

const response = await axios.get(
  `https://app.getraze.com/external/v1/contacts/${contactId}`,
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

contact_id = 'cnt_abc123def456'

response = requests.get(
    f'https://app.getraze.com/external/v1/contacts/{contact_id}',
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
    "id": "cnt_abc123def456",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+5511999999999",
    "company": "Acme Inc",
    "position": "CEO",
    "source": "linkedin",
    "linkedin_url": "https://linkedin.com/in/johndoe",
    "tags": ["prospect", "decision-maker"],
    "custom_fields": {
      "industry": "Technology",
      "company_size": "50-200"
    },
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-20T14:00:00Z"
  }
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique contact identifier |
| `name` | string | Full name |
| `email` | string | Email address |
| `phone` | string | Phone number |
| `company` | string | Company name |
| `position` | string | Job title/position |
| `source` | string | Lead source |
| `linkedin_url` | string | LinkedIn profile URL |
| `tags` | array | Array of tag strings |
| `custom_fields` | object | Custom field key-value pairs |
| `created_at` | string | ISO 8601 creation timestamp |
| `updated_at` | string | ISO 8601 last update timestamp |

## Errors

| Status | Code | Description |
|--------|------|-------------|
| 404 | `NOT_FOUND` | Contact with this ID was not found |
