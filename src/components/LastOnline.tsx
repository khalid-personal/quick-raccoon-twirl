import React from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { cn } from '@/lib/utils';

interface LastOnlineProps {
  at?: string | null;
  online?: boolean;
  className?: string;
}

const LastOnline: React.FC<LastOnlineProps> = ({ at, online = false, className }) => {
  const date = at ? new Date(at) : null;
  const validDate = date && Number.isFinite(date.getTime()) ? date : null;
  const label = online
    ? 'Online now'
    : validDate
      ? `Last seen ${formatDistanceToNowStrict(validDate, { addSuffix: true })}`
      : 'No recent activity';

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground', className)}
      title={validDate ? `Most recent local activity: ${validDate.toLocaleString()}` : 'No recent activity in this browser'}
    >
      <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', online ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
      {label}
    </span>
  );
};

export { LastOnline };
export default LastOnline;