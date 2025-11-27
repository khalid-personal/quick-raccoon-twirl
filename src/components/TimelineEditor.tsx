import React, { useState } from 'react';
import { CandidateDetail, ALL_STAGES, CandidateStage } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getStatusColor, cn, getIconComponent } from '@/lib/utils';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import StageEditorDialog from './StageEditorDialog';
import { format } from 'date-fns';
import { FileText } from 'lucide-react';

interface TimelineEditorProps {
  candidateDetail: CandidateDetail;
  refetch: () => void;
}

const TimelineEditor: React.FC<TimelineEditorProps> = ({ candidateDetail, refetch }) => {
  const [openStageId, setOpenStageId] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {candidateDetail.stages.map((cs) => {
        const stage = ALL_STAGES.find(s => s.id === cs.stage_id)!;
        const IconComponent = getIconComponent(stage.icon);
        
        // Determine border color based on status for visual emphasis
        const statusBorderClass = cs.status === 'Passed' || cs.status === 'Issued' || cs.status === 'Completed'
            ? 'border-green-500'
            : cs.status === 'In Progress'
            ? 'border-blue-500'
            : cs.status === 'Failed'
            ? 'border-red-500'
            : 'border-gray-200 dark:border-gray-700';
            
        // Determine hover ring color
        const statusRingClass = cs.status === 'Passed' || cs.status === 'Issued' || cs.status === 'Completed' 
            ? 'hover:ring-green-300/50 dark:hover:ring-green-700/50' :
            cs.status === 'In Progress' ? 'hover:ring-blue-300/50 dark:hover:ring-blue-700/50' :
            cs.status === 'Failed' ? 'hover:ring-red-300/50 dark:hover:ring-red-700/50' : 
            'hover:ring-gray-300/50 dark:hover:ring-gray-600/50';

        // Use the new getStatusColor utility for the badge
        const badgeClass = getStatusColor(cs.status);

        return (
          <Dialog 
            key={stage.id} 
            open={openStageId === stage.id} 
            onOpenChange={(isOpen) => setOpenStageId(isOpen ? stage.id : null)}
          >
            <DialogTrigger asChild>
              <Card 
                className={cn(
                  "cursor-pointer h-full aspect-square flex flex-col justify-center items-center text-center p-4 border-2 transition-all duration-200 hover:shadow-xl hover:ring-4",
                  statusBorderClass,
                  statusRingClass
                )}
              >
                {IconComponent && <IconComponent className="h-8 w-8 text-primary mb-3" />}
                <CardTitle className="text-base font-semibold mb-2 leading-snug">{stage.title}</CardTitle>
                <Badge className={cn("text-xs", badgeClass)}>
                    {cs.status}
                </Badge>
              </Card>
            </DialogTrigger>
            
            <StageEditorDialog
              candidateDetail={candidateDetail}
              candidateStage={cs}
              stage={stage}
              refetch={refetch}
              onClose={() => setOpenStageId(null)}
            />
          </Dialog>
        );
      })}
    </div>
  );
};

export default TimelineEditor;