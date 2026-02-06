import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SchemaData, SchemaColumn } from '@/lib/api';
import { Database, Key, Link2 } from 'lucide-react';

interface SchemaVisualizationProps {
  schema: SchemaData | null;
  isLoading?: boolean;
}

// Custom node component for table visualization
function TableNode({ data }: NodeProps<{ 
  tableName: string; 
  source: string; 
  columns: SchemaColumn[];
}>) {
  return (
    <div className="bg-card border rounded-lg shadow-lg min-w-[200px] overflow-hidden">
      <Handle type="target" position={Position.Left} className="!bg-primary !w-3 !h-3" />
      
      <div className="bg-primary/10 px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">{data.tableName}</span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{data.source}</p>
      </div>
      
      <div className="p-2 space-y-1">
        {data.columns.map((col) => (
          <div
            key={col.name}
            className="flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted/50 transition-colors"
          >
            {col.isPrimaryKey && (
              <Key className="h-3 w-3 text-warning flex-shrink-0" />
            )}
            {col.isForeignKey && !col.isPrimaryKey && (
              <Link2 className="h-3 w-3 text-primary flex-shrink-0" />
            )}
            {!col.isPrimaryKey && !col.isForeignKey && (
              <span className="w-3" />
            )}
            <span className="font-medium flex-1">{col.name}</span>
            <Badge variant="secondary" className="text-[10px] px-1 py-0">
              {col.type}
            </Badge>
          </div>
        ))}
      </div>
      
      <Handle type="source" position={Position.Right} className="!bg-primary !w-3 !h-3" />
    </div>
  );
}

const nodeTypes = { tableNode: TableNode };

export function SchemaVisualization({ schema, isLoading }: SchemaVisualizationProps) {
  // Convert schema data to React Flow format
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!schema) return { initialNodes: [], initialEdges: [] };

    // Position nodes in a grid layout
    const nodes: Node[] = schema.nodes.map((node, index) => ({
      id: node.id,
      type: 'tableNode',
      position: { 
        x: (index % 3) * 320 + 50, 
        y: Math.floor(index / 3) * 280 + 50 
      },
      data: {
        tableName: node.tableName,
        source: node.source,
        columns: node.columns,
      },
    }));

    const edges: Edge[] = schema.edges.map((edge) => ({
      id: edge.id,
      source: edge.source.table,
      target: edge.target.table,
      label: `${edge.source.column} → ${edge.target.column}`,
      labelStyle: { fontSize: 10, fontWeight: 500 },
      labelBgStyle: { fill: 'hsl(var(--background))', fillOpacity: 0.9 },
      labelBgPadding: [4, 2] as [number, number],
      style: { 
        stroke: edge.confidence >= 0.9 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
        strokeWidth: edge.confidence >= 0.9 ? 2 : 1,
        strokeDasharray: edge.confidence < 0.7 ? '5,5' : undefined,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.confidence >= 0.9 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
      },
      animated: edge.confidence >= 0.9,
    }));

    return { initialNodes: nodes, initialEdges: edges };
  }, [schema]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  if (isLoading || !schema) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Schema Visualization</CardTitle>
          <CardDescription>Interactive view of discovered table relationships</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] bg-muted/50 rounded-lg animate-pulse flex items-center justify-center">
            <p className="text-muted-foreground">Loading schema...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Schema Visualization
            </CardTitle>
            <CardDescription>
              Interactive view of discovered table relationships • Drag to rearrange
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="gap-1">
              <Key className="h-3 w-3 text-warning" />
              Primary Key
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Link2 className="h-3 w-3 text-primary" />
              Foreign Key
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] border rounded-lg overflow-hidden bg-muted/20">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.5}
            maxZoom={1.5}
          >
            <Background color="hsl(var(--border))" gap={20} />
            <Controls className="!bg-card !border !shadow-sm" />
            <MiniMap 
              className="!bg-card !border"
              nodeColor="hsl(var(--primary))"
              maskColor="hsl(var(--background) / 0.8)"
            />
          </ReactFlow>
        </div>
      </CardContent>
    </Card>
  );
}
