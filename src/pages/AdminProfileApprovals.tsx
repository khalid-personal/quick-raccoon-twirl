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
import FilterBar from '@/components/page/FilterBar';
import StatCards from '@/components/page/StatCards';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const AdminProfileApprovals: React.FC = () => {
  const { user, userRole, isLoading: authLoading } = useAuth();
  const client = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState<'all' | 'photo' | 'contact'>('all');
  const [rejection, setRejection] = React.useState<StaffUser | null>(null);
  const [reason, setReason] = React.useState('');
  const reasonId = React.useId();
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
    onSuccess: () => { toast.success('Profile update rejected.'); setRejection(null); setReason(''); void refresh(); },
    onError: error => toast.error(error instanceof Error ? error.message : 'Rejection failed.'),
  });

  if (authLoading) return <div className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  if (userRole !== 'superadmin') return <Navigate to="/admin" replace />;
  const visible = pending.filter(item => item.email.toLowerCase().includes(search.toLowerCase()) && (filter === 'all' || (filter === 'photo' ? !!item.profile_edit_data?.profile_image_url : !!item.profile_edit_data?.phone_number)));

  return <div className="space-y-6">
    <PageHeader title="Profile approvals" description="Review requested staff profile photo and contact changes." />
    <StatCards items={[
      { label: 'Awaiting review', value: pending.length, active: filter === 'all', onClick: () => setFilter('all') },
      { label: 'Photo changes', value: pending.filter(item => item.profile_edit_data?.profile_image_url).length, active: filter === 'photo', onClick: () => setFilter('photo') },
      { label: 'Contact changes', value: pending.filter(item => item.profile_edit_data?.phone_number).length, active: filter === 'contact', onClick: () => setFilter('contact') },
    ]} />
    <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Find a staff profile request" />
    {isLoading ? <div className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin" /></div>
      : isError ? <p role="alert" className="text-destructive">Could not load profile approvals.</p>
        : visible.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{pending.length ? 'No profile requests match this view.' : 'No profile updates are waiting for approval.'}</CardContent></Card>
          : <div className="grid gap-3 md:grid-cols-2">{visible.map(item => <Card key={item.id}><CardContent className="flex flex-wrap items-start gap-4 p-5">
            <UserAvatar user={{ ...item, profile_image_url: item.profile_edit_data?.profile_image_url || item.profile_image_url }} className="h-16 w-16" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.email}</p><p className="text-xs text-muted-foreground">Requested {item.profile_edit_requested_at ? new Date(item.profile_edit_requested_at).toLocaleString() : 'recently'}</p>
              {item.profile_edit_data?.phone_number && <p className="mt-2 text-sm">Phone: {item.profile_edit_data.phone_number}</p>}
              <Badge variant="outline" className="mt-2">Pending review</Badge>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <Button size="sm" disabled={approve.isPending || reject.isPending} onClick={() => approve.mutate(item.id)}><Check className="mr-1 h-4 w-4" />Approve</Button>
              <Button size="sm" variant="outline" disabled={approve.isPending || reject.isPending} onClick={() => { setReason(''); setRejection(item); }}><X className="mr-1 h-4 w-4" />Reject</Button>
            </div>
          </CardContent></Card>)}</div>}
    <Dialog open={!!rejection} onOpenChange={open => { if (!open && !reject.isPending) setRejection(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Review profile request</DialogTitle><DialogDescription>{rejection?.email} · Give the staff member a clear reason.</DialogDescription></DialogHeader>
        <Label htmlFor={reasonId}>Reason for rejection</Label><Textarea id={reasonId} value={reason} onChange={event => setReason(event.target.value)} disabled={reject.isPending} />
        <DialogFooter><Button variant="outline" disabled={reject.isPending} onClick={() => setRejection(null)}>Cancel</Button><Button disabled={!reason.trim() || reject.isPending} onClick={() => { if (rejection) reject.mutate({ id: rejection.id, reason: reason.trim() }); }}>Reject request</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
};

export default AdminProfileApprovals;
