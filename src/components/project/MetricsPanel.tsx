import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DataMetrics } from '@/lib/api';
import { 
  Database, 
  Users, 
  GitBranch, 
  CheckCircle2, 
  Calendar,
  TrendingUp
} from 'lucide-react';

interface MetricsPanelProps {
  metrics: DataMetrics | null;
  isLoading?: boolean;
}

export function MetricsPanel({ metrics, isLoading }: MetricsPanelProps) {
  const [animatedValues, setAnimatedValues] = useState({
    totalRecords: 0,
    tableCount: 0,
    completenessScore: 0,
  });

  // Animate numbers on load
  useEffect(() => {
    if (!metrics) return;

    const duration = 1000;
    const steps = 30;
    const interval = duration / steps;

    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic

      setAnimatedValues({
        totalRecords: Math.round(metrics.totalRecords * eased),
        tableCount: Math.round(metrics.tableCount * eased),
        completenessScore: Math.round(metrics.completenessScore * eased),
      });

      if (step >= steps) clearInterval(timer);
    }, interval);

    return () => clearInterval(timer);
  }, [metrics]);

  if (isLoading || !metrics) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Data Metrics</CardTitle>
          <CardDescription>AI-extracted statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Data Metrics
        </CardTitle>
        <CardDescription>AI-extracted statistics from your data</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Records */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-2">
          <div className="p-2 rounded-md bg-primary/10">
            <Database className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Total Records</p>
            <p className="text-xl font-semibold tabular-nums">
              {animatedValues.totalRecords.toLocaleString()}
            </p>
          </div>
          <Badge variant="secondary">{animatedValues.tableCount} tables</Badge>
        </div>

        {/* Data Completeness */}
        <div className="p-3 rounded-lg bg-surface-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-sm text-muted-foreground">Data Completeness</span>
            </div>
            <span className="font-semibold">{animatedValues.completenessScore}%</span>
          </div>
          <Progress value={animatedValues.completenessScore} className="h-2" />
        </div>

        {/* Relationships */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-2">
          <div className="p-2 rounded-md bg-secondary/50">
            <GitBranch className="h-4 w-4 text-secondary-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Relationships</p>
            <p className="text-lg font-semibold">
              {metrics.confirmedJoins} confirmed
              {metrics.suggestedJoins > 0 && (
                <span className="text-muted-foreground font-normal">
                  , {metrics.suggestedJoins} suggested
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Unique Entities */}
        <div className="p-3 rounded-lg bg-surface-2">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Unique Entities</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {metrics.uniqueEntities.map((entity) => (
              <Badge key={entity.name} variant="outline" className="gap-1">
                {entity.name}
                <span className="text-primary font-semibold">
                  {entity.count.toLocaleString()}
                </span>
              </Badge>
            ))}
          </div>
        </div>

        {/* Date Range */}
        {metrics.dateRange && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-2">
            <div className="p-2 rounded-md bg-accent/50">
              <Calendar className="h-4 w-4 text-accent-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date Range</p>
              <p className="font-medium">
                {new Date(metrics.dateRange.start).toLocaleDateString()} –{' '}
                {new Date(metrics.dateRange.end).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
