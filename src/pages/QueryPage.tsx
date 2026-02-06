import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { executeQuery, listTables, TableInfo } from '@/lib/api';
import { Loader2, Play, Database, Table } from 'lucide-react';

export default function QueryPage() {
  const [sql, setSql] = useState('SELECT * FROM orders LIMIT 10');
  const [isLoading, setIsLoading] = useState(false);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState(0);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    const data = await listTables();
    setTables(data);
  };

  const handleRunQuery = async () => {
    setIsLoading(true);
    setError(null);
    setColumns([]);
    setRows([]);

    try {
      const result = await executeQuery(sql);
      if (result.success) {
        setColumns(result.columns);
        setRows(result.rows);
        setRowCount(result.row_count);
      } else {
        setError(result.error || 'Query failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTableClick = (tableName: string) => {
    setSql(`SELECT * FROM "${tableName}" LIMIT 100`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Query Database</h1>
          <p className="text-muted-foreground">Run SQL queries against your migrated data</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar: Tables */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4" />
                Tables
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {tables.map((table) => (
                <button
                  key={table.name}
                  onClick={() => handleTableClick(table.name)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm flex items-center justify-between group"
                >
                  <span className="flex items-center gap-2">
                    <Table className="h-3 w-3 text-muted-foreground" />
                    {table.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {table.row_count.toLocaleString()}
                  </span>
                </button>
              ))}
              {tables.length === 0 && (
                <p className="text-sm text-muted-foreground px-3">No tables found</p>
              )}
            </CardContent>
          </Card>

          {/* Main: Query Editor & Results */}
          <div className="lg:col-span-3 space-y-4">
            {/* Query Editor */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">SQL Query</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  placeholder="SELECT * FROM table_name LIMIT 10"
                  className="font-mono text-sm min-h-[100px]"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Only SELECT queries are allowed
                  </p>
                  <Button onClick={handleRunQuery} disabled={isLoading || !sql.trim()}>
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Run Query
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Error */}
            {error && (
              <Card className="border-destructive">
                <CardContent className="pt-4">
                  <p className="text-sm text-destructive">{error}</p>
                </CardContent>
              </Card>
            )}

            {/* Results */}
            {columns.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Results</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {rowCount.toLocaleString()} row{rowCount !== 1 ? 's' : ''}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-auto max-h-[500px]">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          {columns.map((col, i) => (
                            <th key={i} className="px-4 py-2 text-left font-medium border-b">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} className="border-b hover:bg-muted/50">
                            {row.map((cell, j) => (
                              <td key={j} className="px-4 py-2 whitespace-nowrap">
                                {cell === null ? (
                                  <span className="text-muted-foreground italic">null</span>
                                ) : (
                                  String(cell)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
