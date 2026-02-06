import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  getPendingConnection, 
  clearPendingConnection, 
  pollConnectionStatus,
  getProviderDisplayName,
  ComposioProvider 
} from '@/lib/composio';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type CallbackStatus = 'verifying' | 'success' | 'error';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<CallbackStatus>('verifying');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [provider, setProvider] = useState<ComposioProvider | null>(null);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    // Check for error in URL params (OAuth denied)
    const error = searchParams.get('error');
    if (error) {
      setStatus('error');
      setErrorMessage(
        error === 'access_denied' 
          ? 'You denied access to your account. Please try again if you want to connect.'
          : `OAuth error: ${error}`
      );
      return;
    }

    // Get pending connection from localStorage
    const pendingConnection = getPendingConnection();
    if (!pendingConnection) {
      setStatus('error');
      setErrorMessage('No pending connection found. Please try connecting again.');
      return;
    }

    setProvider(pendingConnection.provider);

    try {
      // Poll for connection status
      const result = await pollConnectionStatus(pendingConnection.provider);

      if (result.status === 'ACTIVE') {
        setStatus('success');
        clearPendingConnection();
        
        toast({
          title: 'Connected!',
          description: `${getProviderDisplayName(pendingConnection.provider)} has been connected successfully.`,
        });

        // Redirect back to project after a short delay
        setTimeout(() => {
          navigate(`/projects/${pendingConnection.projectId}?connected=${pendingConnection.provider}`);
        }, 1500);
      } else if (result.status === 'FAILED') {
        setStatus('error');
        setErrorMessage(result.error || 'Connection failed. Please try again.');
        clearPendingConnection();
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error 
          ? error.message 
          : 'Failed to verify connection. Please try again.'
      );
      clearPendingConnection();
    }
  };

  const handleRetry = () => {
    // Go back to projects page to retry
    const pendingConnection = getPendingConnection();
    if (pendingConnection) {
      navigate(`/projects/${pendingConnection.projectId}`);
    } else {
      navigate('/projects');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto p-8">
        <div className="text-center space-y-6">
          {status === 'verifying' && (
            <>
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-semibold">Verifying Connection</h1>
                <p className="text-muted-foreground mt-2">
                  Please wait while we confirm your {provider ? getProviderDisplayName(provider) : 'cloud storage'} connection...
                </p>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center">
                <div className="rounded-full bg-success/10 p-4">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-semibold">Connection Successful!</h1>
                <p className="text-muted-foreground mt-2">
                  Your {provider ? getProviderDisplayName(provider) : 'cloud storage'} account has been connected. Redirecting you back...
                </p>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center">
                <div className="rounded-full bg-destructive/10 p-4">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-semibold">Connection Failed</h1>
                <p className="text-muted-foreground mt-2">{errorMessage}</p>
              </div>
              <Button onClick={handleRetry} className="mt-4">
                Try Again
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
