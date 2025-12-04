# Authentication

The GetRaze API uses API keys to authenticate requests.

## Getting Your API Key

1. Log in to your GetRaze dashboard
2. Navigate to **Settings > API Keys**
3. Click **Create API Key**
4. Configure permissions and rate limits
5. Copy your API key (it will only be shown once)

::: warning
Keep your API key secure. Never share it in public repositories or client-side code.
:::

## Using Your API Key

Include your API key in every request using one of these methods:

### Header (Recommended)

```bash
curl --request GET \
  --url "https://app.getraze.com/external/v1/contacts" \
  --header "X-API-Key: gr_live_xxxxxxxxxxxxx"
```

### Bearer Token

```bash
curl --request GET \
  --url "https://app.getraze.com/external/v1/contacts" \
  --header "Authorization: Bearer gr_live_xxxxxxxxxxxxx"
```

### Query Parameter

```bash
curl --request GET \
  --url "https://app.getraze.com/external/v1/contacts?api_key=gr_live_xxxxxxxxxxxxx"
```

::: tip
We recommend using the `X-API-Key` header for security. Query parameters may be logged by servers.
:::

## API Key Permissions

When creating an API key, you can configure granular permissions:

| Permission | Allows |
|------------|--------|
| `contacts:read` | List and retrieve contacts |
| `contacts:write` | Create and update contacts |
| `contacts:delete` | Delete contacts |
| `opportunities:read` | List and retrieve opportunities |
| `opportunities:write` | Create and update opportunities |
| `opportunities:delete` | Delete opportunities |

## Key Rotation

For security, we recommend rotating your API keys periodically:

1. Create a new API key with the same permissions
2. Update your applications to use the new key
3. Revoke the old API key

## Authentication Errors

| Status | Error Code | Description |
|--------|------------|-------------|
| 401 | `MISSING_API_KEY` | No API key provided |
| 401 | `INVALID_API_KEY` | API key is invalid or revoked |
| 403 | `INSUFFICIENT_PERMISSIONS` | API key lacks required permission |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
