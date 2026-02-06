
# Composio OAuth Integration Plan

## Overview
Integrate real OAuth authentication for Google Drive and Microsoft OneDrive using Composio as the backend service. The flow involves redirecting users to Composio-managed OAuth URLs and handling callbacks to confirm active connections.

---

## OAuth Flow Architecture

```text
+----------------+       +------------------+       +------------+       +-----------------+
|   Frontend     |       |   Your Backend   |       |  Composio  |       |  Google/MS      |
|   (Lovable)    |       |   (REST API)     |       |            |       |  OAuth Provider |
+-------+--------+       +--------+---------+       +-----+------+       +--------+--------+
        |                         |                       |                       |
        | 1. Click "Connect"      |                       |                       |
        +------------------------>|                       |                       |
        |                         | 2. POST /api/composio |                       |
        |                         |    /connect/google    |                       |
        |                         +---------------------->|                       |
        |                         |                       | 3. Create connection  |
        |                         |<----------------------+    & get redirect_url |
        | 4. Receive redirect_url |                       |                       |
        |<------------------------+                       |                       |
        |                                                                         |
        | 5. Browser redirects to OAuth provider                                  |
        +------------------------------------------------------------------------>|
        |                                                                         |
        |                         6. User grants access                           |
        |<------------------------------------------------------------------------+
        |                                                                         |
        | 7. Redirect to callback URL (your app)                                  |
        +------------------------------------------------------------------------>|
        |                         |                       |                       |
        | 8. GET /api/composio    |                       |                       |
        |    /status?provider=... |                       |                       |
        +------------------------>|                       |                       |
        |                         | 9. Check connection   |                       |
        |                         +---------------------->|                       |
        |                         |<----------------------+                       |
        | 10. Connection ACTIVE   |                       |                       |
        |<------------------------+                       |                       |
        |                                                                         |
        | 11. Show FileBrowser UI                                                 |
        +                                                                         +
```

---

## Files to Create/Modify

### 1. New: `src/lib/composio.ts`
A dedicated API module for Composio integration:
- `initiateConnection(provider)` - Calls backend to start OAuth, returns redirect URL
- `checkConnectionStatus(provider)` - Polls backend for connection status
- `getConnectedAccounts()` - Lists all active connections
- Type definitions for `ConnectionStatus`, `ComposioProvider`

### 2. New: `src/pages/OAuthCallback.tsx`
Callback page that Composio redirects to after OAuth:
- Extracts query params (provider, status, error)
- Shows loading state while verifying connection
- Calls status API to confirm connection
- Redirects back to project with success/error toast
- Handles error states gracefully

### 3. Modify: `src/App.tsx`
- Add route: `/auth/callback` pointing to OAuthCallback component
- Keep it as a protected route (user must be logged in)

### 4. Modify: `src/components/project/CloudConnections.tsx`
Complete rewrite of connection handling:
- Replace mock timeout with real `initiateConnection()` call
- Handle redirect URL - open in same window
- Store pending connection state in localStorage (survives redirect)
- Show connection error states with retry option

### 5. Modify: `src/pages/ProjectDetail.tsx`
- Check for existing connections on mount
- Pass project ID to CloudConnections
- Handle connection state restoration after OAuth redirect
- Store connected provider info for file fetching

### 6. Modify: `src/lib/api.ts`
- Add `API_BASE_URL` configuration (environment variable)
- Update `getSpreadsheets()` to accept provider type
- Backend will use Composio connection to fetch actual files

---

## Technical Details

### Environment Configuration
The frontend needs to know the backend API URL:
```typescript
// src/lib/config.ts
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
```

### Connection State Persistence
To survive OAuth redirect, store state in localStorage:
```typescript
interface PendingConnection {
  projectId: string;
  provider: 'google-drive' | 'onedrive';
  initiatedAt: string;
}
```

### API Endpoints (Backend Contract)

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/api/composio/connect/google` | POST | `{ projectId }` | `{ redirectUrl, connectionId }` |
| `/api/composio/connect/onedrive` | POST | `{ projectId }` | `{ redirectUrl, connectionId }` |
| `/api/composio/status` | GET | `?provider=google-drive` | `{ status: 'ACTIVE' \| 'PENDING' \| 'FAILED', email? }` |
| `/api/composio/connections` | GET | - | `[{ provider, email, connectedAt }]` |

### Error Handling
- Network errors: Show toast with retry option
- OAuth denied: Display clear message, allow re-attempt  
- Connection timeout: Poll with exponential backoff (max 30s)
- Backend errors: Surface error message from API

---

## Implementation Order

1. Create `src/lib/config.ts` for API configuration
2. Create `src/lib/composio.ts` with API functions
3. Create `src/pages/OAuthCallback.tsx` callback handler
4. Update `src/App.tsx` with callback route
5. Refactor `CloudConnections.tsx` for real OAuth
6. Update `ProjectDetail.tsx` for connection state
7. Update `api.ts` to use connected provider for file fetching

---

## User Experience Flow

1. User clicks "Connect Google Drive"
2. Button shows loading spinner
3. User is redirected to Google OAuth consent screen
4. After granting access, user returns to `/auth/callback`
5. Callback page shows "Verifying connection..."
6. On success, redirects to project page with toast "Google Drive connected"
7. FileBrowser appears with real spreadsheet files

## Error States Handled
- User denies OAuth permission
- Connection times out
- Backend API unreachable
- Invalid/expired connection
