import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

interface AgentStatusPanelProps {
  isActive: boolean;
  onComplete: () => void;
}

interface StatusStep {
  id: string;
  label: string;
  description: string;
  duration: number; // ms
}

const steps: StatusStep[] = [
  { id: 'upload', label: 'Uploading files', description: 'Sending file metadata to analysis engine', duration: 1500 },
  { id: 'scan', label: 'Scanning files', description: 'Reading spreadsheet structure and content', duration: 2500 },
  { id: 'analyze', label: 'Analyzing columns', description: 'Detecting data types and patterns', duration: 2000 },
  { id: 'infer', label: 'Inferring relationships', description: 'Identifying potential joins between tables', duration: 3000 },
  { id: 'complete', label: 'Analysis complete', description: 'Results are ready to view', duration: 0 },
];

export function AgentStatusPanel({ isActive, onComplete }: AgentStatusPanelProps) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setCurrentStep(-1);
      setProgress(0);
      return;
    }

    let stepIndex = 0;
    let progressInterval: NodeJS.Timeout;

    const runStep = () => {
      if (stepIndex >= steps.length) {
        onComplete();
        return;
      }

      setCurrentStep(stepIndex);
      const step = steps[stepIndex];
      
      if (step.duration === 0) {
        setProgress(100);
        onComplete();
        return;
      }

      // Animate progress for this step
      const stepStartProgress = (stepIndex / steps.length) * 100;
      const stepEndProgress = ((stepIndex + 1) / steps.length) * 100;
      const increment = (stepEndProgress - stepStartProgress) / (step.duration / 50);
      let currentProgress = stepStartProgress;

      progressInterval = setInterval(() => {
        currentProgress += increment;
        if (currentProgress >= stepEndProgress) {
          currentProgress = stepEndProgress;
          clearInterval(progressInterval);
          stepIndex++;
          setTimeout(runStep, 300);
        }
        setProgress(currentProgress);
      }, 50);
    };

    runStep();

    return () => {
      clearInterval(progressInterval);
    };
  }, [isActive, onComplete]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Agent Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isActive && currentStep === -1 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">Select files and start analysis to see agent activity</p>
          </div>
        ) : (
          <>
            <Progress value={progress} className="h-2" />
            
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-start gap-3 transition-opacity ${
                    index > currentStep ? 'opacity-40' : ''
                  }`}
                >
                  <div className="mt-0.5">
                    {index < currentStep ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : index === currentStep ? (
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${
                      index === currentStep ? 'text-foreground' : 
                      index < currentStep ? 'text-muted-foreground' : ''
                    }`}>
                      {step.label}
                    </p>
                    {index === currentStep && (
                      <p className="text-xs text-muted-foreground mt-0.5 animate-slide-in">
                        {step.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
