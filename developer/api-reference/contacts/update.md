# Update Contact

<Badge type="warning" text="PUT" /> `/external/v1/contacts/:id`

Updates an existing contact. Only provided fields will be updated.

## Authentication

Requires `contacts:write` permission.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The unique identifier of the contact |

## Request Body

All fields are optional. Only include fields you want to update.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Full name of the contact |
| `email` | string | Email address |
| `phone` | string | Phone number |
| `company` | string | Company name |
| `position` | string | Job title/position |
| `linkedin_url` | string | LinkedIn profile URL |
| `tags` | array | Array of tag strings (replaces existing tags) |
| `custom_fields` | object | Custom field key-value pairs |

## Request

::: code-group

```bash [cURL]
curl --request PUT \
  --url "https://app.getraze.com/external/v1/contacts/cnt_abc123def456" \
  --header "Content-Type: application/json" \
  --header "X-API-Key: YOUR_API_KEY" \
  --data '{
    "position": "VP of Engineering",
    "tags": ["hot-lead", "enterprise"]
  }'
```

```javascript [Node.js]
const axios = require('axios');

const contactId = 'cnt_abc123def456';

const response = await axios.put(
  `https://app.getraze.com/external/v1/contacts/${contactId}`,
  {
    position: 'VP of Engineering',
    tags: ['hot-lead', 'enterprise']
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

contact_id = 'cnt_abc123def456'

response = requests.put(
    f'https://app.getraze.com/external/v1/contacts/{contact_id}',
    headers={
        'X-API-Key': 'YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'position': 'VP of Engineering',
        'tags': ['hot-lead', 'enterprise']
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
    "id": "cnt_abc123def456",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+5511999999999",
    "company": "Acme Inc",
    "position": "VP of Engineering",
    "source": "linkedin",
    "linkedin_url": "https://linkedin.com/in/johndoe",
    "tags": ["hot-lead", "enterprise"],
    "custom_fields": {},
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-25T10:00:00Z"
  }
}
```

## Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid field values |
| 404 | `NOT_FOUND` | Contact not found |
