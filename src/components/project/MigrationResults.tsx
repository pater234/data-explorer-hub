import { MigrateResponse } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Database, Code, AlertCircle, CheckCircle2, ScrollText } from 'lucide-react';

interface MigrationResultsProps {
  result: MigrateResponse;
}

export function MigrationResults({ result }: MigrationResultsProps) {
  const totalRows = Object.values(result.rows_inserted).reduce((a, b) => a + b, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <AlertCircle className="h-5 w-5 text-warning" />
              )}
              Migration Results
            </CardTitle>
            <CardDescription>
              {result.tables_created.length} tables created with {totalRows.toLocaleString()} total rows
            </CardDescription>
          </div>
          <Badge variant={result.success ? 'default' : 'secondary'}>
            {result.success ? 'Success' : 'Partial'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="logs">
          <TabsList className="mb-4">
            <TabsTrigger value="logs" className="gap-2">
              <ScrollText className="h-4 w-4" />
              Logs ({result.logs?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="tables" className="gap-2">
              <Database className="h-4 w-4" />
              Tables ({result.tables_created.length})
            </TabsTrigger>
            <TabsTrigger value="ddl" className="gap-2">
              <Code className="h-4 w-4" />
              DDL
            </TabsTrigger>
            {result.errors.length > 0 && (
              <TabsTrigger value="errors" className="gap-2">
                <AlertCircle className="h-4 w-4" />
                Errors ({result.errors.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="logs">
            <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-96 font-mono text-sm">
              {result.logs?.map((log, index) => (
                <div key={index} className="text-gray-100 py-0.5">
                  {log}
                </div>
              )) || <div className="text-gray-500">No logs available</div>}
            </div>
          </TabsContent>

          <TabsContent value="tables">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table Name</TableHead>
                  <TableHead className="text-right">Rows Inserted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.tables_created.map((table) => (
                  <TableRow key={table}>
                    <TableCell className="font-medium font-mono">{table}</TableCell>
                    <TableCell className="text-right">
                      {(result.rows_inserted[table] || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="ddl">
            <div className="bg-muted rounded-lg p-4 overflow-auto max-h-96">
              <pre className="text-sm font-mono whitespace-pre-wrap">{result.ddl}</pre>
            </div>
          </TabsContent>

          {result.errors.length > 0 && (
            <TabsContent value="errors">
              <div className="space-y-2">
                {result.errors.map((error, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                  >
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
