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
    <div className="space-y-4">
      {candidateDetail.stages.map((cs) => {
        const stage = ALL_STAGES.find(s => s.id === cs.stage_id)!;
        const IconComponent = getIconComponent(stage.icon);
        const documentsForStage = candidateDetail.documents.filter(doc => doc.stage_id === stage.id);

        return (
          <Dialog 
            key={stage.id} 
            open={openStageId === stage.id} 
            onOpenChange={(isOpen) => setOpenStageId(isOpen ? stage.id : null)}
          >
            <DialogTrigger asChild>
              <Card 
                className={cn(
                  "cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/50",
                  getStatusColor(cs.status).replace('text-white', 'text-foreground') // Ensure text is readable on card body
                )}
              >
                <CardHeader className={cn("flex flex-row items-center justify-between p-4", getStatusColor(cs.status))}>
                  <div className="flex items-center space-x-3">
                    {IconComponent && <IconComponent className="h-5 w-5 text-white" />}
                    <CardTitle className="text-white text-lg">{stage.title}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-sm font-semibold">
                    Current: {cs.status}
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="font-medium text-muted-foreground">Last Update Date</p>
                    <p className="font-semibold">
                      {cs.date ? format(new Date(cs.date), 'PPP') : 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-muted-foreground">Reference ID</p>
                    <p className="font-semibold">
                      {cs.reference_id || 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-muted-foreground">Documents</p>
                    <p className="font-semibold flex items-center">
                      <FileText className="h-4 w-4 mr-1 text-primary" />
                      {documentsForStage.length} uploaded
                    </p>
                  </div>
                </CardContent>
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