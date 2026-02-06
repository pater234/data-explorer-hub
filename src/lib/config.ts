// API Configuration
// Set VITE_API_BASE_URL in your environment to point to your backend

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// OAuth callback URL - where Composio redirects after OAuth
export const OAUTH_CALLBACK_URL = `${window.location.origin}/auth/callback`;
