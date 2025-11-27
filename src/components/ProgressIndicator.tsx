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
      <div className="flex justify-end items-center">
        <span className="text-xl font-bold text-primary">{percent}%</span>
      </div>
      <Progress value={percent} className="h-3" />
    </div>
  );
};

export default ProgressIndicator;