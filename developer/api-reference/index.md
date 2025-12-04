# API Reference

Welcome to the GetRaze API. Use our REST API to integrate GetRaze functionality into your applications.

## Base URL

```
https://app.getraze.com/external/v1
```

## Authentication

All API requests require authentication using an API key. Include your API key in the request header:

```bash
X-API-Key: your_api_key_here
```

Or using Bearer token format:

```bash
Authorization: Bearer your_api_key_here
```

## Quick Start

### 1. Get your API Key

Navigate to **Settings > API Keys** in your GetRaze dashboard to create a new API key.

### 2. Make your first request

```bash
curl --request GET \
  --url "https://app.getraze.com/external/v1/contacts" \
  --header "X-API-Key: YOUR_API_KEY"
```

### 3. Response

```json
{
  "success": true,
  "data": {
    "contacts": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "total_pages": 8
    }
  }
}
```

## Available Endpoints

### Contacts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/contacts` | List all contacts |
| GET | `/contacts/:id` | Retrieve a contact |
| POST | `/contacts` | Create a contact |
| PUT | `/contacts/:id` | Update a contact |
| DELETE | `/contacts/:id` | Delete a contact |

### Opportunities

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/opportunities` | List all opportunities |
| GET | `/opportunities/:id` | Retrieve an opportunity |
| POST | `/opportunities` | Create an opportunity |
| PUT | `/opportunities/:id` | Update an opportunity |
| PATCH | `/opportunities/:id/stage` | Update opportunity stage |
| DELETE | `/opportunities/:id` | Delete an opportunity |

## Rate Limits

Each API key has configurable rate limits. Default is **1000 requests per hour**.

Rate limit information is included in response headers:

- `X-RateLimit-Limit`: Maximum requests per hour
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Permissions

API keys use granular permissions:

| Permission | Description |
|------------|-------------|
| `contacts:read` | Read contact data |
| `contacts:write` | Create and update contacts |
| `contacts:delete` | Delete contacts |
| `opportunities:read` | Read opportunity data |
| `opportunities:write` | Create and update opportunities |
| `opportunities:delete` | Delete opportunities |
