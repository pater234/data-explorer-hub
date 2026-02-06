import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProject, Project } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { CloudConnections } from '@/components/project/CloudConnections';
import { FileBrowser } from '@/components/project/FileBrowser';
import { AgentStatusPanel } from '@/components/project/AgentStatusPanel';
import { ResultsDisplay } from '@/components/project/ResultsDisplay';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  useEffect(() => {
    if (id) {
      loadProject(id);
    }
  }, [id]);

  const loadProject = async (projectId: string) => {
    setIsLoading(true);
    try {
      const data = await getProject(projectId);
      setProject(data);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = () => {
    setIsConnected(true);
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
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="text-muted-foreground mt-1">{project.description}</p>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Connections & Files */}
          <div className="lg:col-span-2 space-y-6">
            {!isConnected ? (
              <CloudConnections onConnect={handleConnect} />
            ) : (
              <FileBrowser
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
