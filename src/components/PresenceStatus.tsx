import React from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { cn } from '@/lib/utils';

interface PresenceStatusProps {
  online: boolean;
  lastSeen?: string;
  className?: string;
}

const PresenceStatus: React.FC<PresenceStatusProps> = ({ online, lastSeen, className }) => {
  const date = lastSeen ? new Date(lastSeen) : null;
  const validDate = date && Number.isFinite(date.getTime()) ? date : null;
  const label = online ? 'Online' : validDate ? `Last seen ${formatDistanceToNowStrict(validDate, { addSuffix: true })}` : 'No local activity';
  return <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground', className)} title={validDate ? `Local browser activity: ${validDate.toLocaleString()}` : 'No activity recorded in this browser'}>
    <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', online ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />{label}
  </span>;
};

export default PresenceStatus;
