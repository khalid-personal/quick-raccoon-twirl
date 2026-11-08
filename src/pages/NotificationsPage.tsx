import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { Bell, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import type { Notification } from '@/lib/types';
import PageHeader from '@/components/page/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { evidenceNotificationScope } from '@/lib/evidence-notifications';

const NotificationsPage: React.FC = () => {
  const { user, userRole, userLocalAgencyId, viewAs } = useAuth();
  const userId = viewAs?.userId ?? user?.id;
  const scope = evidenceNotificationScope(userRole, viewAs?.userId ? viewAs.label : user?.email, userLocalAgencyId);
  const queryClient = useQueryClient();
  const queryKey = ['notifications', userId, userRole, userLocalAgencyId];
  const { data: notifications = [], isLoading, isError } = useQuery<Notification[]>({
    queryKey,
    queryFn: () => api.getNotificationsForUser(userId ?? '', scope),
    enabled: !!userId,
    refetchInterval: 60_000,
  });
  React.useEffect(() => {
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['notifications'] }); };
    window.addEventListener('bank-statement-changed', refresh);
    window.addEventListener('notifications-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('bank-statement-changed', refresh); window.removeEventListener('notifications-changed', refresh); window.removeEventListener('storage', refresh); };
  }, [queryClient]);
  const invalidate = () => queryClient.invalidateQueries({ queryKey });
  const markRead = useMutation({ mutationFn: api.markNotificationRead, onSuccess: invalidate });
  const markAllRead = useMutation({ mutationFn: () => api.markAllNotificationsReadForUser(userId ?? '', scope), onSuccess: invalidate });
  const sorted = [...notifications].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const unreadCount = notifications.filter(notification => !notification.read).length;

  return <div className="space-y-6">
    <PageHeader title="Notifications" description={`${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}.`} actions={
      <Button variant="outline" disabled={!unreadCount || markAllRead.isPending} onClick={() => markAllRead.mutate()}><Check className="mr-2 h-4 w-4" />Mark all read</Button>
    } />
    <Card><CardContent className="divide-y p-0">
      {isLoading ? <p className="p-8 text-center text-muted-foreground">Loading notifications...</p>
        : isError ? <p role="alert" className="p-8 text-center text-destructive">Could not load notifications. Please try again.</p>
          : sorted.length === 0 ? <div className="p-10 text-center"><Bell className="mx-auto mb-2 h-5 w-5 text-muted-foreground" /><p className="text-sm text-muted-foreground">You are all caught up.</p></div>
          : sorted.map(notification => {
            const content = <div className="min-w-0 flex-1"><p className={cn('text-sm', !notification.read && 'font-semibold')}>{notification.message}</p><p className="mt-1 text-xs text-muted-foreground">{formatDistanceToNowStrict(new Date(notification.created_at), { addSuffix: true })}</p></div>;
            return <div key={notification.id} className="flex items-center gap-3 px-4 py-3">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', notification.read ? 'bg-muted' : 'bg-primary')} />
              {notification.link ? <Link className="min-w-0 flex-1 hover:underline" to={notification.link} onClick={() => { if (!notification.read) markRead.mutate(notification.id); }}>{content}</Link> : content}
              {!notification.read && <Button size="sm" variant="ghost" disabled={markRead.isPending} onClick={() => markRead.mutate(notification.id)}>Mark read</Button>}
            </div>;
          })}
    </CardContent></Card>
  </div>;
};

export default NotificationsPage;
