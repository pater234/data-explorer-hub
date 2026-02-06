import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface CloudConnectionsProps {
  onConnect: () => void;
}

export function CloudConnections({ onConnect }: CloudConnectionsProps) {
  const [connectingTo, setConnectingTo] = useState<string | null>(null);

  const handleConnect = async (provider: 'google-drive' | 'onedrive') => {
    setConnectingTo(provider);
    // Simulate OAuth flow
    await new Promise(resolve => setTimeout(resolve, 1500));
    setConnectingTo(null);
    onConnect();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Data Source</CardTitle>
        <CardDescription>
          Connect your cloud storage to access spreadsheet files
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Google Drive */}
          <button
            onClick={() => handleConnect('google-drive')}
            disabled={connectingTo !== null}
            className="group relative flex flex-col items-center gap-4 p-6 rounded-lg border-2 border-dashed hover:border-primary/50 hover:bg-surface-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {connectingTo === 'google-drive' ? (
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            ) : (
              <svg className="h-10 w-10" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
            )}
            <div className="text-center">
              <p className="font-medium">Google Drive</p>
              <p className="text-sm text-muted-foreground">
                Connect to Google Sheets and Excel files
              </p>
            </div>
          </button>

          {/* OneDrive */}
          <button
            onClick={() => handleConnect('onedrive')}
            disabled={connectingTo !== null}
            className="group relative flex flex-col items-center gap-4 p-6 rounded-lg border-2 border-dashed hover:border-primary/50 hover:bg-surface-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {connectingTo === 'onedrive' ? (
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            ) : (
              <svg className="h-10 w-10" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M14.5 14.1L9.6 7.4C9.9 7.3 10.2 7.2 10.6 7.2C11.4 7.2 12.2 7.5 12.8 8L19 14.1H14.5Z" fill="#0364B8"/>
                <path d="M9.6 7.4L14.5 14.1H5.2C4 14.1 3 13.1 3 11.9C3 10.9 3.6 10 4.5 9.7C4.3 9.3 4.2 8.9 4.2 8.4C4.2 6.9 5.4 5.7 6.9 5.7C7.5 5.7 8.1 5.9 8.5 6.2C8.8 5.2 9.8 4.5 11 4.5C12.1 4.5 13 5.2 13.3 6.2" fill="#0078D4"/>
                <path d="M19 14.1H14.5L9.6 7.4C9.9 7.3 10.2 7.2 10.6 7.2C11.4 7.2 12.2 7.5 12.8 8L19 14.1Z" fill="#1490DF"/>
                <path d="M19 14.1L12.8 8C13.3 8.5 13.6 9.1 13.7 9.8C14.6 10 15.3 10.7 15.5 11.6C15.6 11.5 15.8 11.5 16 11.5C17.4 11.5 18.5 12.5 18.7 13.8C18.8 13.9 18.9 13.9 19 13.9C19 13.9 19 14 19 14.1Z" fill="#28A8EA"/>
                <path d="M19 14.1C19 14.1 19 14.1 19 14.2C19 15.5 17.9 16.5 16.6 16.5H6.4C5.1 16.5 4 15.5 4 14.1H5.2H14.5H19Z" fill="#0078D4"/>
              </svg>
            )}
            <div className="text-center">
              <p className="font-medium">Microsoft OneDrive</p>
              <p className="text-sm text-muted-foreground">
                Connect to Excel files in OneDrive
              </p>
            </div>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
