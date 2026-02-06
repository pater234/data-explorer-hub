import { API_BASE_URL, OAUTH_CALLBACK_URL } from './config';

// Types
export type ComposioProvider = 'google-drive' | 'onedrive';

export type ConnectionStatus = 'ACTIVE' | 'PENDING' | 'FAILED';

export interface ConnectionResponse {
  redirectUrl: string;
  connectionId: string;
}

export interface ConnectionStatusResponse {
  status: ConnectionStatus;
  email?: string;
  error?: string;
}

export interface ConnectedAccount {
  provider: ComposioProvider;
  email: string;
  connectedAt: string;
}

export interface PendingConnection {
  projectId: string;
  provider: ComposioProvider;
  connectionId: string;
  initiatedAt: string;
}

// LocalStorage keys
const PENDING_CONNECTION_KEY = 'composio_pending_connection';

// Store pending connection state (survives OAuth redirect)
export function storePendingConnection(connection: PendingConnection): void {
  localStorage.setItem(PENDING_CONNECTION_KEY, JSON.stringify(connection));
}

export function getPendingConnection(): PendingConnection | null {
  const stored = localStorage.getItem(PENDING_CONNECTION_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored) as PendingConnection;
  } catch {
    return null;
  }
}

export function clearPendingConnection(): void {
  localStorage.removeItem(PENDING_CONNECTION_KEY);
}

// Demo mode flag - set to true when backend is unavailable
const USE_MOCK_DATA = false;

// Mock data for demo mode
const MOCK_CONNECTED_ACCOUNTS: ConnectedAccount[] = [
  {
    provider: 'google-drive',
    email: 'demo@example.com',
    connectedAt: new Date().toISOString(),
  },
];

// API Functions

/**
 * Initiates OAuth connection flow with Composio
 * Returns a redirect URL that the frontend should navigate to
 */
export async function initiateConnection(
  provider: ComposioProvider,
  projectId: string
): Promise<ConnectionResponse> {
  // Demo mode: simulate successful connection
  if (USE_MOCK_DATA) {
    console.log('[Demo Mode] Simulating OAuth connection for', provider);
    // Return a fake connection that will redirect back to our callback
    return {
      redirectUrl: `${window.location.origin}/auth/callback?provider=${provider}&status=success`,
      connectionId: `demo-${Date.now()}`,
    };
  }

  const endpoint = provider === 'google-drive' 
    ? '/api/composio/connect/google'
    : '/api/composio/connect/onedrive';

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      projectId,
      redirectUrl: OAUTH_CALLBACK_URL,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to initiate connection' }));
    throw new Error(error.message || 'Failed to initiate connection');
  }

  return response.json();
}

/**
 * Check the status of a connection
 */
export async function checkConnectionStatus(
  provider: ComposioProvider
): Promise<ConnectionStatusResponse> {
  // Demo mode: always return active
  if (USE_MOCK_DATA) {
    return {
      status: 'ACTIVE',
      email: 'demo@example.com',
    };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/composio/status?provider=${provider}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to check connection status' }));
    throw new Error(error.message || 'Failed to check connection status');
  }

  return response.json();
}

/**
 * Poll connection status with exponential backoff
 */
export async function pollConnectionStatus(
  provider: ComposioProvider,
  maxAttempts: number = 10,
  initialDelay: number = 1000
): Promise<ConnectionStatusResponse> {
  let attempt = 0;
  let delay = initialDelay;

  while (attempt < maxAttempts) {
    try {
      const status = await checkConnectionStatus(provider);
      
      if (status.status === 'ACTIVE' || status.status === 'FAILED') {
        return status;
      }
      
      // Still pending, wait and retry
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.5, 5000); // Cap at 5 seconds
      attempt++;
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.5, 5000);
      attempt++;
    }
  }

  throw new Error('Connection verification timed out');
}

/**
 * Get all connected accounts
 */
export async function getConnectedAccounts(): Promise<ConnectedAccount[]> {
  // Demo mode: return mock connected account
  if (USE_MOCK_DATA) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    return MOCK_CONNECTED_ACCOUNTS;
  }

  const response = await fetch(`${API_BASE_URL}/api/composio/connections`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch connections' }));
    throw new Error(error.message || 'Failed to fetch connections');
  }

  return response.json();
}

/**
 * Get display name for provider
 */
export function getProviderDisplayName(provider: ComposioProvider): string {
  switch (provider) {
    case 'google-drive':
      return 'Google Drive';
    case 'onedrive':
      return 'Microsoft OneDrive';
    default:
      return provider;
  }
}
