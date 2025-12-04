# Rate Limits

The GetRaze API implements rate limiting to ensure fair usage and maintain service stability.

## Default Limits

| Plan | Requests per Hour |
|------|-------------------|
| Free | 100 |
| Pro | 1,000 |
| Business | 5,000 |
| Enterprise | Custom |

## Rate Limit Headers

Every API response includes rate limit information in the headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1701388800
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed per hour |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when the limit resets |

## Handling Rate Limits

When you exceed the rate limit, the API returns a `429 Too Many Requests` response:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please wait before making more requests.",
    "retry_after": 3600
  }
}
```

### Best Practices

1. **Check headers**: Monitor `X-RateLimit-Remaining` to avoid hitting limits
2. **Implement backoff**: Use exponential backoff when receiving 429 errors
3. **Cache responses**: Cache data that doesn't change frequently
4. **Batch requests**: Use list endpoints instead of making many individual requests

## Example: Handling Rate Limits

```javascript
async function makeRequest(url, options, retries = 3) {
  const response = await fetch(url, options);

  // Check remaining requests
  const remaining = response.headers.get('X-RateLimit-Remaining');
  if (remaining && parseInt(remaining) < 10) {
    console.warn('Approaching rate limit');
  }

  // Handle rate limit exceeded
  if (response.status === 429) {
    if (retries > 0) {
      const retryAfter = response.headers.get('Retry-After') || 60;
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return makeRequest(url, options, retries - 1);
    }
    throw new Error('Rate limit exceeded');
  }

  return response.json();
}
```

## Custom Rate Limits

Enterprise customers can configure custom rate limits per API key. Contact support to discuss your requirements.
