# Create Contact

<Badge type="info" text="POST" /> `/external/v1/contacts`

Creates a new contact in your account.

## Authentication

Requires `contacts:write` permission.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Full name of the contact |
| `email` | string | No | Email address |
| `phone` | string | No | Phone number with country code |
| `company` | string | No | Company name |
| `position` | string | No | Job title/position |
| `linkedin_url` | string | No | LinkedIn profile URL |
| `source` | string | No | Lead source (default: "other") |
| `tags` | array | No | Array of tag strings |
| `custom_fields` | object | No | Custom field key-value pairs |

## Request

::: code-group

```bash [cURL]
curl --request POST \
  --url "https://app.getraze.com/external/v1/contacts" \
  --header "Content-Type: application/json" \
  --header "X-API-Key: YOUR_API_KEY" \
  --data '{
    "name": "Jane Smith",
    "email": "jane@company.com",
    "phone": "+5511988888888",
    "company": "Tech Corp",
    "position": "CTO",
    "tags": ["hot-lead", "tech"]
  }'
```

```javascript [Node.js]
const axios = require('axios');

const response = await axios.post(
  'https://app.getraze.com/external/v1/contacts',
  {
    name: 'Jane Smith',
    email: 'jane@company.com',
    phone: '+5511988888888',
    company: 'Tech Corp',
    position: 'CTO',
    tags: ['hot-lead', 'tech']
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
    'https://app.getraze.com/external/v1/contacts',
    headers={
        'X-API-Key': 'YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'name': 'Jane Smith',
        'email': 'jane@company.com',
        'phone': '+5511988888888',
        'company': 'Tech Corp',
        'position': 'CTO',
        'tags': ['hot-lead', 'tech']
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
    "id": "cnt_xyz789abc123",
    "name": "Jane Smith",
    "email": "jane@company.com",
    "phone": "+5511988888888",
    "company": "Tech Corp",
    "position": "CTO",
    "source": "other",
    "tags": ["hot-lead", "tech"],
    "custom_fields": {},
    "created_at": "2024-01-25T09:00:00Z",
    "updated_at": "2024-01-25T09:00:00Z"
  }
}
```

## Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Required fields missing or invalid |
| 400 | `INVALID_EMAIL` | Email format is invalid |
| 409 | `ALREADY_EXISTS` | Contact with this email already exists |
