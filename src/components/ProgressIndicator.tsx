import React from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ProgressIndicatorProps {
  percent: number;
  className?: string;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ percent, className }) => {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Overall Progress</h3>
        <span className="text-xl font-bold text-primary">{percent}%</span>
      </div>
      <Progress value={percent} className="h-3" />
    </div>
  );
};

export default ProgressIndicator;