import { useState, useEffect } from 'react';
import { getSpreadsheets, SpreadsheetFile } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Folder, Loader2, Play, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface FileBrowserProps {
  selectedFiles: string[];
  onFilesSelected: (fileIds: string[]) => void;
  onStartAnalysis: () => void;
  analysisStarted: boolean;
}

export function FileBrowser({
  selectedFiles,
  onFilesSelected,
  onStartAnalysis,
  analysisStarted,
}: FileBrowserProps) {
  const [files, setFiles] = useState<SpreadsheetFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const data = await getSpreadsheets('mock-source');
      setFiles(data);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFile = (fileId: string) => {
    if (analysisStarted) return;
    
    if (selectedFiles.includes(fileId)) {
      onFilesSelected(selectedFiles.filter(id => id !== fileId));
    } else {
      onFilesSelected([...selectedFiles, fileId]);
    }
  };

  const toggleAll = () => {
    if (analysisStarted) return;
    
    if (selectedFiles.length === files.length) {
      onFilesSelected([]);
    } else {
      onFilesSelected(files.map(f => f.id));
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(0)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      return <FileSpreadsheet className="h-5 w-5 text-success" />;
    }
    if (mimeType.includes('csv')) {
      return <FileSpreadsheet className="h-5 w-5 text-primary" />;
    }
    return <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Select Files</CardTitle>
            <CardDescription>
              Choose spreadsheets to analyze and connect
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadFiles}
              disabled={isLoading || analysisStarted}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={onStartAnalysis}
              disabled={selectedFiles.length === 0 || analysisStarted}
            >
              <Play className="h-4 w-4 mr-2" />
              Analyze {selectedFiles.length > 0 && `(${selectedFiles.length})`}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-1">
            {/* Select All */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-2">
              <Checkbox
                checked={selectedFiles.length === files.length && files.length > 0}
                onCheckedChange={toggleAll}
                disabled={analysisStarted}
              />
              <span className="text-sm font-medium">
                {selectedFiles.length === files.length
                  ? 'Deselect all'
                  : 'Select all files'}
              </span>
              <Badge variant="secondary" className="ml-auto">
                {files.length} files
              </Badge>
            </div>

            {/* File List */}
            <div className="divide-y">
              {files.map((file) => (
                <div
                  key={file.id}
                  onClick={() => toggleFile(file.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedFiles.includes(file.id)
                      ? 'bg-primary/5 border border-primary/20'
                      : 'hover:bg-surface-2'
                  } ${analysisStarted ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <Checkbox
                    checked={selectedFiles.includes(file.id)}
                    disabled={analysisStarted}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={() => toggleFile(file.id)}
                  />
                  {getFileIcon(file.mimeType)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {file.path && (
                        <>
                          <Folder className="h-3 w-3" />
                          <span>{file.path}</span>
                          <span>•</span>
                        </>
                      )}
                      <span>
                        Modified{' '}
                        {formatDistanceToNow(new Date(file.modifiedTime), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                  {file.size && (
                    <span className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
