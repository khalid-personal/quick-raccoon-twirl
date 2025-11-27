import React from 'react';
import { PublicTrackingData, StageStatus, MedicalStatus } from '@/lib/types';
import { getStatusColor, cn } from '@/lib/utils';
import { CheckCircle, Clock, XCircle, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface TrackingTimelineProps {
  timeline: PublicTrackingData['timeline'];
  isPublicView: boolean;
}

const getIconForStatus = (status: StageStatus | MedicalStatus) => {
  switch (status) {
    case 'Passed':
    case 'Issued':
    case 'Completed':
      return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
    case 'Failed':
      return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    case 'In Progress':
      return <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    case 'Pending':
    default:
      return <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
  }
};

const TrackingTimeline: React.FC<TrackingTimelineProps> = ({ timeline, isPublicView }) => {
  return (
    <div className="relative pl-6 border-l border-gray-300 dark:border-gray-700">
      {timeline.map((item, index) => {
        const displayStatus = isPublicView && item.is_medical_stage 
          ? item.medical_status_summary || item.status 
          : item.status;
        
        const statusText = displayStatus.toUpperCase();
        // Use a simplified color class for the badge background
        const statusColorClass = getStatusColor(displayStatus).split(' ')[0]; // e.g., 'bg-green-600'
        
        // Determine text color for badge based on status
        const statusTextColor = displayStatus === 'Pending' ? 'text-gray-800 dark:text-gray-200' : 'text-white';

        const isLast = index === timeline.length - 1;

        return (
          <div key={item.title} className={cn("mb-8 relative", { "pb-0": isLast })}>
            {/* Timeline Dot */}
            <div className="absolute -left-3 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-gray-900 shadow-lg ring-4 ring-gray-100 dark:ring-gray-800">
              {getIconForStatus(displayStatus)}
            </div>

            <div className="ml-4">
              <h3 className="text-xl font-semibold mb-1 flex items-center">
                {item.title}
                <Badge 
                  className={cn("ml-3 text-xs font-medium", statusColorClass, statusTextColor)}
                >
                  {statusText}
                </Badge>
              </h3>
              
              {item.date && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Date: {format(new Date(item.date), 'PPP')}
                </p>
              )}

              {item.notes && !isPublicView && (
                <p className="text-sm text-gray-700 dark:text-gray-300 italic mb-2">
                  Notes: {item.notes}
                </p>
              )}
              
              {/* Public View Medical Compliance Note */}
              {isPublicView && item.is_medical_stage && (
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Medical Status: <span className={cn("font-bold", displayStatus === 'Passed' ? 'text-green-600' : displayStatus === 'Failed' ? 'text-red-600' : 'text-yellow-600')}>
                    {displayStatus}
                  </span>
                </p>
              )}

              {/* Documents (Public View: Thumbnails/Links) */}
              {item.documents.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Documents ({item.documents.length}):</p>
                  <div className="flex flex-wrap gap-2">
                    {item.documents.map(doc => (
                      <a 
                        key={doc.id} 
                        href={doc.public_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        {doc.file_name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TrackingTimeline;