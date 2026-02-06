import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Loader2, XCircle, Database, FileSearch, Edit3 } from 'lucide-react';

interface MigrationStatusProps {
  isActive: boolean;
  isComplete: boolean;
  error: string | null;
  stage?: 'idle' | 'analyzing' | 'review' | 'migrating' | 'complete';
}

export function MigrationStatus({ isActive, isComplete, error, stage = 'idle' }: MigrationStatusProps) {
  const getStageDisplay = () => {
    if (!isActive && !isComplete) {
      return (
        <div className="text-center py-6 text-muted-foreground">
          <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select files and start analysis</p>
        </div>
      );
    }

    if (stage === 'review') {
      return (
        <div className="flex items-center gap-3 py-4">
          <Edit3 className="h-5 w-5 text-blue-500" />
          <div>
            <p className="font-medium">Review Schema</p>
            <p className="text-sm text-muted-foreground">
              Review the proposed schema and make any edits
            </p>
          </div>
        </div>
      );
    }

    if (isActive && !isComplete && stage !== 'review') {
      return (
        <div className="flex items-center gap-3 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="font-medium">
              {stage === 'migrating' ? 'Migrating data...' : 'Analyzing files...'}
            </p>
            <p className="text-sm text-muted-foreground">
              {stage === 'migrating'
                ? 'Creating tables and inserting data'
                : 'Downloading files and inferring schema'
              }
            </p>
          </div>
        </div>
      );
    }

    if (isComplete && error) {
      return (
        <div className="flex items-center gap-3 py-4">
          <XCircle className="h-5 w-5 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Migration Failed</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3 py-4">
        <CheckCircle2 className="h-5 w-5 text-success" />
        <div>
          <p className="font-medium text-success">Migration Complete</p>
          <p className="text-sm text-muted-foreground">
            Data has been migrated to PostgreSQL
          </p>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Status</CardTitle>
      </CardHeader>
      <CardContent>
        {getStageDisplay()}
      </CardContent>
    </Card>
  );
}
