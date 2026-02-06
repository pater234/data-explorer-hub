import { useState, useEffect } from 'react';
import { getAnalysisResults, AnalysisResult, TableSchema, JoinProposal } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, Database, GitBranch, Lightbulb, Loader2 } from 'lucide-react';

export function ResultsDisplay() {
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    setIsLoading(true);
    try {
      const data = await getAnalysisResults('mock-job');
      setResults(data);
    } finally {
      setIsLoading(false);
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) return <Badge className="bg-success/10 text-success border-success/20">High</Badge>;
    if (confidence >= 0.7) return <Badge className="bg-warning/10 text-warning border-warning/20">Medium</Badge>;
    return <Badge variant="secondary">Low</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!results) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analysis Results</CardTitle>
        <CardDescription>
          Discovered tables, relationships, and insights from your data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="tables">
          <TabsList className="mb-4">
            <TabsTrigger value="tables" className="gap-2">
              <Database className="h-4 w-4" />
              Tables ({results.tables.length})
            </TabsTrigger>
            <TabsTrigger value="joins" className="gap-2">
              <GitBranch className="h-4 w-4" />
              Joins ({results.joinProposals.length})
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              Insights ({results.insights.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tables" className="space-y-4">
            {results.tables.map((table) => (
              <TableCard key={table.id} table={table} />
            ))}
          </TabsContent>

          <TabsContent value="joins" className="space-y-3">
            {results.joinProposals.map((join) => (
              <div
                key={join.id}
                className="flex items-center gap-4 p-4 rounded-lg border bg-surface-2"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <span>{join.sourceTable}</span>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {join.sourceColumn}
                    </code>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <span>{join.targetTable}</span>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {join.targetColumn}
                    </code>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {join.joinType}
                  </Badge>
                  {getConfidenceBadge(join.confidence)}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="insights">
            <div className="space-y-2">
              {results.insights.map((insight, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg bg-surface-2"
                >
                  <Lightbulb className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{insight}</p>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function TableCard({ table }: { table: TableSchema }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-surface-2 px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">{table.name}</h4>
            <p className="text-xs text-muted-foreground">
              Source: {table.source}
            </p>
          </div>
          <Badge variant="secondary">{table.rowCount.toLocaleString()} rows</Badge>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Column</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Unique</TableHead>
            <TableHead className="text-right">Nulls</TableHead>
            <TableHead>Sample Values</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.columns.map((column) => (
            <TableRow key={column.name}>
              <TableCell className="font-medium">{column.name}</TableCell>
              <TableCell>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  {column.type}
                </code>
              </TableCell>
              <TableCell className="text-right">{column.uniqueCount.toLocaleString()}</TableCell>
              <TableCell className="text-right">{column.nullCount}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {column.sampleValues.slice(0, 2).join(', ')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
