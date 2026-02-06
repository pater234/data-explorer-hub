import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Loader2, XCircle, Database } from 'lucide-react';

interface MigrationStatusProps {
  isActive: boolean;
  isComplete: boolean;
  error: string | null;
}

export function MigrationStatus({ isActive, isComplete, error }: MigrationStatusProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Migration Status</CardTitle>
      </CardHeader>
      <CardContent>
        {!isActive && !isComplete ? (
          <div className="text-center py-6 text-muted-foreground">
            <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select files and start migration</p>
          </div>
        ) : isActive && !isComplete ? (
          <div className="flex items-center gap-3 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="font-medium">Migrating data...</p>
              <p className="text-sm text-muted-foreground">
                Downloading files, inferring schema, creating tables
              </p>
            </div>
          </div>
        ) : isComplete && error ? (
          <div className="flex items-center gap-3 py-4">
            <XCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Migration Failed</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div>
              <p className="font-medium text-success">Migration Complete</p>
              <p className="text-sm text-muted-foreground">
                Data has been migrated to PostgreSQL
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
