import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { StaffUser } from '@/lib/types';
import PageHeader from '@/components/page/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import UserAvatar from '@/components/UserAvatar';

const AdminProfileApprovals: React.FC = () => {
  const { user, userRole, isLoading: authLoading } = useAuth();
  const client = useQueryClient();
  const { data: pending = [], isLoading, isError } = useQuery<StaffUser[]>({
    queryKey: ['pendingProfileUpdates'],
    queryFn: api.getUsersWithPendingProfileUpdates,
    enabled: !authLoading && userRole === 'superadmin',
  });
  const refresh = () => client.invalidateQueries({ queryKey: ['pendingProfileUpdates'] });
  const approve = useMutation({
    mutationFn: (id: string) => api.approveStaffProfileUpdate(user?.id ?? '', id),
    onSuccess: () => { toast.success('Profile update approved.'); void refresh(); },
    onError: error => toast.error(error instanceof Error ? error.message : 'Approval failed.'),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.rejectStaffProfileUpdate(user?.id ?? '', id, reason),
    onSuccess: () => { toast.success('Profile update rejected.'); void refresh(); },
    onError: error => toast.error(error instanceof Error ? error.message : 'Rejection failed.'),
  });

  if (authLoading) return <div className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  if (userRole !== 'superadmin') return <Navigate to="/admin" replace />;

  return <div className="space-y-6">
    <PageHeader title="Profile approvals" description="Review requested staff profile photo and contact changes." />
    {isLoading ? <div className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin" /></div>
      : isError ? <p role="alert" className="text-destructive">Could not load profile approvals.</p>
        : pending.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No profile updates are waiting for approval.</CardContent></Card>
          : <div className="grid gap-3 md:grid-cols-2">{pending.map(item => <Card key={item.id}><CardContent className="flex items-start gap-4 p-4">
            <UserAvatar user={{ ...item, profile_image_url: item.profile_edit_data?.profile_image_url || item.profile_image_url }} className="h-16 w-16" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.email}</p><p className="text-xs text-muted-foreground">Requested {item.profile_edit_requested_at ? new Date(item.profile_edit_requested_at).toLocaleString() : 'recently'}</p>
              {item.profile_edit_data?.phone_number && <p className="mt-2 text-sm">Phone: {item.profile_edit_data.phone_number}</p>}
              <Badge variant="outline" className="mt-2">Pending review</Badge>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <Button size="sm" disabled={approve.isPending || reject.isPending} onClick={() => approve.mutate(item.id)}><Check className="mr-1 h-4 w-4" />Approve</Button>
              <Button size="sm" variant="outline" disabled={approve.isPending || reject.isPending} onClick={() => { const reason = window.prompt('Reason for rejection'); if (reason?.trim()) reject.mutate({ id: item.id, reason: reason.trim() }); }}><X className="mr-1 h-4 w-4" />Reject</Button>
            </div>
          </CardContent></Card>)}</div>}
  </div>;
};

export default AdminProfileApprovals;
