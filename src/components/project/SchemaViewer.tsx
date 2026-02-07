import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Key, Link } from 'lucide-react';

interface SchemaViewerProps {
  ddl: string;
}

interface ParsedTable {
  name: string;
  columns: ParsedColumn[];
}

interface ParsedColumn {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: string;
}

function parseDDL(ddl: string): ParsedTable[] {
  const tables: ParsedTable[] = [];

  // Match CREATE TABLE statements
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?\s*\(([\s\S]*?)\);/gi;

  let match;
  while ((match = tableRegex.exec(ddl)) !== null) {
    const tableName = match[1];
    const columnsBlock = match[2];

    const columns: ParsedColumn[] = [];

    // Split by comma but not within parentheses
    const lines = columnsBlock.split(/,(?![^()]*\))/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Skip constraints that aren't column definitions
      if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT)/i.test(trimmed)) {
        // Check for PRIMARY KEY constraint to mark columns
        const pkMatch = trimmed.match(/PRIMARY\s+KEY\s*\(["']?(\w+)["']?\)/i);
        if (pkMatch) {
          const col = columns.find(c => c.name.toLowerCase() === pkMatch[1].toLowerCase());
          if (col) col.isPrimaryKey = true;
        }

        // Check for FOREIGN KEY constraint
        const fkMatch = trimmed.match(/FOREIGN\s+KEY\s*\(["']?(\w+)["']?\)\s*REFERENCES\s+["']?(\w+)["']?/i);
        if (fkMatch) {
          const col = columns.find(c => c.name.toLowerCase() === fkMatch[1].toLowerCase());
          if (col) {
            col.isForeignKey = true;
            col.references = fkMatch[2];
          }
        }
        continue;
      }

      // Parse column definition: "column_name" TYPE constraints
      const colMatch = trimmed.match(/["']?(\w+)["']?\s+(\w+(?:\([^)]+\))?)/i);
      if (colMatch) {
        const isPK = /PRIMARY\s+KEY/i.test(trimmed);
        const fkRefMatch = trimmed.match(/REFERENCES\s+["']?(\w+)["']?/i);

        columns.push({
          name: colMatch[1],
          type: colMatch[2].toUpperCase(),
          isPrimaryKey: isPK,
          isForeignKey: !!fkRefMatch,
          references: fkRefMatch ? fkRefMatch[1] : undefined,
        });
      }
    }

    tables.push({ name: tableName, columns });
  }

  return tables;
}

export function SchemaViewer({ ddl }: SchemaViewerProps) {
  const tables = parseDDL(ddl);

  if (tables.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No schema to display</p>
      </div>
    );
  }

  // Find relationships
  const relationships: { from: string; fromCol: string; to: string; toCol: string }[] = [];
  for (const table of tables) {
    for (const col of table.columns) {
      if (col.isForeignKey && col.references) {
        relationships.push({
          from: table.name,
          fromCol: col.name,
          to: col.references,
          toCol: 'id', // Assume id
        });
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Relationships summary */}
      {relationships.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
          <span className="text-sm font-medium flex items-center gap-1">
            <Link className="h-4 w-4" />
            Relationships:
          </span>
          {relationships.map((rel, i) => (
            <Badge key={i} variant="secondary" className="font-mono text-xs">
              {rel.from}.{rel.fromCol} → {rel.to}
            </Badge>
          ))}
        </div>
      )}

      {/* Tables grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tables.map((table) => (
          <Card key={table.name} className="overflow-hidden">
            <CardHeader className="py-3 bg-muted/50">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Table className="h-4 w-4" />
                {table.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {table.columns.map((col, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      {col.isPrimaryKey && (
                        <Key className="h-3 w-3 text-yellow-500" />
                      )}
                      {col.isForeignKey && (
                        <Link className="h-3 w-3 text-blue-500" />
                      )}
                      <span className={col.isPrimaryKey ? 'font-medium' : ''}>
                        {col.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {col.type}
                      </Badge>
                      {col.references && (
                        <span className="text-xs text-muted-foreground">
                          → {col.references}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
