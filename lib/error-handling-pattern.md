# Standardized Error Handling Pattern

## Overview

All API routes should use standardized error handling to ensure:
- Consistent error responses
- No sensitive information leakage in production
- Proper security event logging
- Better debugging in development

## Helper Functions

### `handleApiError()`
Main function for handling errors in catch blocks:

```typescript
import { handleApiError } from '@/lib/api-security';

try {
  // ... route logic ...
} catch (error: any) {
  // Handle auth errors first
  if (error.message === "Unauthorized") {
    return unauthorizedResponse();
  }
  
  // Use standardized error handler
  return handleApiError(error, 'event_name', userId, 500, 'Custom message');
}
```

### `handleAuthError()`
For authentication/authorization errors:

```typescript
import { handleAuthError } from '@/lib/api-security';

try {
  const auth = await requireApiAuth(request);
} catch (error: any) {
  return handleAuthError(error);
}
```

### `handleValidationError()`
For input validation errors:

```typescript
import { handleValidationError } from '@/lib/api-security';

const validation = validateInput(data, rules);
if (!validation.valid) {
  return handleValidationError(validation.errors, 'event_name', userId);
}
```

### `handleNotFoundError()`
For resource not found errors:

```typescript
import { handleNotFoundError } from '@/lib/api-security';

if (!resource) {
  return handleNotFoundError('User', 'user_not_found', userId);
}
```

## Error Response Format

All errors follow this standard format:

```typescript
{
  error: string;        // Human-readable error message
  message?: string;     // Additional context
  details?: string;     // Only in development
  code?: string;        // Error code for client handling
}
```

## Status Codes

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (authorization failed)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (duplicate resource)
- `422` - Unprocessable Entity (validation failed)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error (server errors)

## Security

- **Production**: No stack traces, no sensitive details
- **Development**: Full error details for debugging
- **All errors**: Logged as security events

## Migration Pattern

**Before:**
```typescript
catch (error: any) {
  console.error("Error:", error);
  logSecurityEvent('event_name', userId, { error: error.message });
  const response = NextResponse.json(
    { 
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    },
    { status: 500 }
  );
  return addSecurityHeaders(response, request);
}
```

**After:**
```typescript
catch (error: any) {
  if (error.message === "Unauthorized") {
    return unauthorizedResponse();
  }
  return handleApiError(error, 'event_name', userId, 500);
}
```

