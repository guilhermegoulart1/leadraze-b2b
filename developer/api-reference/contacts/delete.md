# Delete Contact

<Badge type="danger" text="DELETE" /> `/external/v1/contacts/:id`

Permanently deletes a contact from your account.

## Authentication

Requires `contacts:delete` permission.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The unique identifier of the contact |

::: danger
This action is permanent and cannot be undone. The contact and all associated data will be permanently deleted.
:::

## Request

::: code-group

```bash [cURL]
curl --request DELETE \
  --url "https://app.getraze.com/external/v1/contacts/cnt_abc123def456" \
  --header "X-API-Key: YOUR_API_KEY"
```

```javascript [Node.js]
const axios = require('axios');

const contactId = 'cnt_abc123def456';

const response = await axios.delete(
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

response = requests.delete(
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
  "message": "Contact deleted successfully"
}
```

## Errors

| Status | Code | Description |
|--------|------|-------------|
| 404 | `NOT_FOUND` | Contact not found |
