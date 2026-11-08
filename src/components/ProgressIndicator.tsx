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
      <Progress aria-label="Journey progress" value={Math.max(0, Math.min(100, percent))} className="h-2" />
    </div>
  );
};

export default ProgressIndicator;