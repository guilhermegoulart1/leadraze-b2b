# Error Handling

The GetRaze API uses conventional HTTP response codes to indicate success or failure.

## HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request - Invalid parameters |
| `401` | Unauthorized - Invalid or missing API key |
| `403` | Forbidden - Insufficient permissions |
| `404` | Not Found - Resource doesn't exist |
| `429` | Too Many Requests - Rate limit exceeded |
| `500` | Internal Server Error |

## Error Response Format

All errors return a consistent JSON structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

## Error Codes

### Authentication Errors

| Code | Status | Description |
|------|--------|-------------|
| `MISSING_API_KEY` | 401 | No API key was provided |
| `INVALID_API_KEY` | 401 | API key is invalid or has been revoked |
| `EXPIRED_API_KEY` | 401 | API key has expired |
| `INSUFFICIENT_PERMISSIONS` | 403 | API key lacks required permission |

### Validation Errors

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Request body validation failed |
| `INVALID_PARAMETER` | 400 | Invalid query parameter |
| `MISSING_REQUIRED_FIELD` | 400 | Required field is missing |
| `INVALID_EMAIL` | 400 | Email format is invalid |

### Resource Errors

| Code | Status | Description |
|------|--------|-------------|
| `NOT_FOUND` | 404 | Requested resource was not found |
| `ALREADY_EXISTS` | 409 | Resource already exists |
| `CONFLICT` | 409 | Operation conflicts with current state |

### Rate Limiting

| Code | Status | Description |
|------|--------|-------------|
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests, try again later |

## Example Error Responses

### Missing API Key

```json
{
  "success": false,
  "error": {
    "code": "MISSING_API_KEY",
    "message": "API key is required. Include it in the X-API-Key header."
  }
}
```

### Validation Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "fields": {
        "email": "Invalid email format",
        "name": "Name is required"
      }
    }
  }
}
```

### Resource Not Found

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Contact not found"
  }
}
```

## Handling Errors

```javascript
async function apiCall(endpoint, options) {
  const response = await fetch(endpoint, options);
  const data = await response.json();

  if (!data.success) {
    switch (data.error.code) {
      case 'RATE_LIMIT_EXCEEDED':
        // Wait and retry
        await sleep(60000);
        return apiCall(endpoint, options);

      case 'INVALID_API_KEY':
        // Check your API key configuration
        throw new Error('Invalid API key');

      case 'VALIDATION_ERROR':
        // Log validation details
        console.error('Validation errors:', data.error.details);
        throw new Error(data.error.message);

      default:
        throw new Error(data.error.message);
    }
  }

  return data;
}
```
