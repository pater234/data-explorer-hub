import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getProject, Project } from '@/lib/api';
import { getConnectedAccounts, ComposioProvider, ConnectedAccount } from '@/lib/composio';
import { AppLayout } from '@/components/layout/AppLayout';
import { CloudConnections } from '@/components/project/CloudConnections';
import { FileBrowser } from '@/components/project/FileBrowser';
import { AgentStatusPanel } from '@/components/project/AgentStatusPanel';
import { ResultsDisplay } from '@/components/project/ResultsDisplay';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [activeProvider, setActiveProvider] = useState<ComposioProvider | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  useEffect(() => {
    if (id) {
      loadProject(id);
      checkExistingConnections();
    }
  }, [id]);

  // Handle connection success from OAuth callback
  useEffect(() => {
    const connectedProvider = searchParams.get('connected');
    if (connectedProvider) {
      setActiveProvider(connectedProvider as ComposioProvider);
      // Clean up URL
      setSearchParams({});
      // Refresh connections
      checkExistingConnections();
    }
  }, [searchParams]);

  const loadProject = async (projectId: string) => {
    setIsLoading(true);
    try {
      const data = await getProject(projectId);
      setProject(data);
    } finally {
      setIsLoading(false);
    }
  };

  const checkExistingConnections = async () => {
    try {
      const accounts = await getConnectedAccounts();
      setConnectedAccounts(accounts);
      
      // If there's an active connection, set it as the active provider
      if (accounts.length > 0 && !activeProvider) {
        setActiveProvider(accounts[0].provider);
      }
    } catch (error) {
      // Silently fail - user just needs to connect
      console.log('No existing connections found');
    }
  };

  const handleConnect = (provider: ComposioProvider) => {
    // This is called when connection is initiated
    // The actual connection completion is handled via the OAuth callback
  };

  const handleFilesSelected = (fileIds: string[]) => {
    setSelectedFiles(fileIds);
  };

  const handleStartAnalysis = () => {
    setAnalysisStarted(true);
  };

  const handleAnalysisComplete = () => {
    setAnalysisComplete(true);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="text-center py-24">
          <h2 className="text-xl font-medium mb-2">Project not found</h2>
          <p className="text-muted-foreground mb-4">
            The project you're looking for doesn't exist.
          </p>
          <Button onClick={() => navigate('/projects')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </div>
      </AppLayout>
    );
  }

  const isConnected = activeProvider !== null || connectedAccounts.length > 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/projects')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              {isConnected && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </Badge>
              )}
            </div>
            {project.description && (
              <p className="text-muted-foreground mt-1">{project.description}</p>
            )}
          </div>
        </div>

        {/* Connected Accounts Summary */}
        {connectedAccounts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {connectedAccounts.map((account) => (
              <Badge key={account.provider} variant="outline" className="py-1.5">
                {account.provider === 'google-drive' ? '🔵 Google Drive' : '🔷 OneDrive'}
                {account.email && ` • ${account.email}`}
              </Badge>
            ))}
          </div>
        )}

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Connections & Files */}
          <div className="lg:col-span-2 space-y-6">
            {!isConnected ? (
              <CloudConnections 
                projectId={id!} 
                onConnect={handleConnect} 
              />
            ) : (
              <FileBrowser
                provider={activeProvider!}
                selectedFiles={selectedFiles}
                onFilesSelected={handleFilesSelected}
                onStartAnalysis={handleStartAnalysis}
                analysisStarted={analysisStarted}
              />
            )}

            {analysisComplete && <ResultsDisplay />}
          </div>

          {/* Right Column - Status */}
          <div className="space-y-6">
            <AgentStatusPanel
              isActive={analysisStarted}
              onComplete={handleAnalysisComplete}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
