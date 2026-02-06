import { useState } from 'react';
import { AnalyzeResponse } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollText, Code, Table, CheckCircle2, Edit3, RotateCcw } from 'lucide-react';

interface SchemaReviewProps {
  analysis: AnalyzeResponse;
  onApprove: (ddl: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function SchemaReview({ analysis, onApprove, onCancel, isLoading }: SchemaReviewProps) {
  const [ddl, setDdl] = useState(analysis.proposed_ddl);
  const [isEditing, setIsEditing] = useState(false);

  const handleReset = () => {
    setDdl(analysis.proposed_ddl);
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Review Schema
            </CardTitle>
            <CardDescription>
              Review and edit the proposed database schema before migration
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={() => onApprove(ddl)} disabled={isLoading}>
              {isLoading ? (
                'Migrating...'
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve & Migrate
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="schema">
          <TabsList className="mb-4">
            <TabsTrigger value="schema" className="gap-2">
              <Code className="h-4 w-4" />
              Schema (DDL)
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Table className="h-4 w-4" />
              Data Preview
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <ScrollText className="h-4 w-4" />
              Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schema">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {isEditing ? 'Edit the SQL schema below:' : 'Proposed schema from Gemini AI:'}
                </p>
                <div className="flex gap-2">
                  {isEditing && (
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Reset
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    <Edit3 className="h-4 w-4 mr-1" />
                    {isEditing ? 'Preview' : 'Edit'}
                  </Button>
                </div>
              </div>

              {isEditing ? (
                <Textarea
                  value={ddl}
                  onChange={(e) => setDdl(e.target.value)}
                  className="font-mono text-sm min-h-[400px]"
                  placeholder="Enter your SQL DDL here..."
                />
              ) : (
                <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-[400px]">
                  <pre className="text-sm font-mono text-gray-100 whitespace-pre-wrap">{ddl}</pre>
                </div>
              )}

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  <strong>Tip:</strong> If you see type mismatches (like INTEGER for text columns),
                  click "Edit" and change the column type to VARCHAR(255) or TEXT.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview">
            <div className="space-y-4">
              {Object.entries(analysis.file_previews).map(([filename, rows]) => (
                <div key={filename} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 border-b">
                    <h4 className="font-medium">{filename}</h4>
                  </div>
                  <div className="overflow-auto max-h-48">
                    <table className="w-full text-sm">
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} className={i === 0 ? 'bg-muted/50 font-medium' : ''}>
                            <td className="px-4 py-2 border-b whitespace-nowrap font-mono text-xs">
                              {row}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-96 font-mono text-sm">
              {analysis.logs.map((log, index) => (
                <div key={index} className="text-gray-100 py-0.5">
                  {log}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
