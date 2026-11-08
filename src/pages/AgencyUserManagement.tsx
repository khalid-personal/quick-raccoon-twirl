import { LastOnline } from '@/components/LastOnline';
import UserAvatar from '@/components/UserAvatar';
import { usePresence } from '@/hooks/use-presence';
import { presenceFor } from '@/lib/presence';
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { StaffUser, UserRole } from '@/lib/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/page/PageHeader';
import StatCards from '@/components/page/StatCards';
import FilterBar from '@/components/page/FilterBar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, UserPlus, Users, ShieldCheck, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { Navigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import StaffUserEditorDialog from '@/components/StaffUserEditorDialog';
import NewStaffUserForm from '@/components/NewStaffUserForm';
import { ApprovalLog } from '@/lib/types';
import { UserCog } from 'lucide-react';
import { hasRole } from '@/lib/utils/role-utils';
 

const AgencyUserManagement: React.FC = () => {
  const { userRole, userForeignAgencyId, user, isLoading: isAuthLoading } = useAuth();
  const presence = usePresence();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const [isLogsDialogOpen, setIsLogsDialogOpen] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState<ApprovalLog[]>([]);
  const currentUserId = user?.id;
  const actorId = user?.id || 'unknown-admin';
  const actorEmail = user?.email || 'unknown-admin@agency.com';

  // Data hooks declared unconditionally; prevent fetch until auth is resolved
  const { data: users = [], isLoading } = useQuery<StaffUser[]>({ queryKey: ['staffUsers'], queryFn: api.getAllStaffUsers, enabled: !isAuthLoading });
  const agencyUsers = users.filter(u => u.foreign_agency_id === userForeignAgencyId);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return agencyUsers.filter(item => {
      if (filter === 'approved' && !item.is_approved) return false;
      if (filter === 'pending' && item.is_approved) return false;
      return !term || `${item.email} ${item.role}`.toLowerCase().includes(term);
    });
  }, [agencyUsers, search, filter]);

  const approvalMutation = useMutation({ mutationFn: ({ userId, role, isApproved }: { userId: string, role: Exclude<UserRole,'candidate'>, isApproved: boolean }) => api.updateUserRole(userId, role, isApproved, actorId, actorEmail, userRole ?? undefined, userForeignAgencyId ?? undefined), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staffUsers'] }), onError: (error: Error) => toast.error(error.message) });

  if (isAuthLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!hasRole(userRole ?? undefined, ['agency', 'foreign-agency', 'foreign-agency-staff'])) {
    toast.error('Access Denied: You do not have permission to view this page.');
    return <Navigate to="/login" replace />;
  }

  const handleApprovalToggle = (s: StaffUser) => approvalMutation.mutate({ userId: s.id, role: s.role, isApproved: !s.is_approved });
  const openEdit = (s: StaffUser) => { setSelectedUser(s); setIsEditDialogOpen(true); };
  const handleAddSuccess = () => { queryClient.invalidateQueries({ queryKey: ['staffUsers'] }); setIsAddDialogOpen(false); };
  const handleEditSuccess = () => { queryClient.invalidateQueries({ queryKey: ['staffUsers'] }); setIsEditDialogOpen(false); };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Foreign Agency Staff Management"
        description="Approve and manage the people who sign in on behalf of your agency."
        actions={<Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 mr-2" /> Add Staff</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle>Create New Staff for Your Agency</DialogTitle></DialogHeader>
            <NewStaffUserForm onSuccess={handleAddSuccess} onClose={() => setIsAddDialogOpen(false)} defaultRole={'foreign-agency-staff'} defaultForeignAgencyId={userForeignAgencyId!} />
          </DialogContent>
        </Dialog>}
      />
      <StatCards items={[
        { label: 'Staff', value: agencyUsers.length, icon: <Users className="h-4 w-4" />, onClick: () => setFilter('all'), active: filter === 'all' },
        { label: 'Approved', value: agencyUsers.filter(item => item.is_approved).length, icon: <ShieldCheck className="h-4 w-4 text-emerald-600" />, onClick: () => setFilter(filter === 'approved' ? 'all' : 'approved'), active: filter === 'approved' },
        { label: 'Pending approval', value: agencyUsers.filter(item => !item.is_approved).length, icon: <Clock className="h-4 w-4 text-amber-600" />, onClick: () => setFilter(filter === 'pending' ? 'all' : 'pending'), active: filter === 'pending' },
      ]} />
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Staff</CardTitle>
          <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search email or role" filters={[['all', 'All'], ['approved', 'Approved'], ['pending', 'Pending']]} filter={filter} onFilterChange={setFilter} />
        </CardHeader>
        <CardContent>
          <Table>
                <TableHeader><TableRow><TableHead className="text-left">Email</TableHead><TableHead>Role</TableHead><TableHead>Approved</TableHead><TableHead>Last Sync</TableHead><TableHead>Last Online</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {visibleUsers.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No staff match.</TableCell></TableRow>}
                  {visibleUsers.map(s => (
                      (() => { const online = presenceFor(presence, 'staff', s.id, s.last_online_at); return <TableRow key={s.id}><TableCell className="py-2"><span className="flex items-center gap-2"><UserAvatar user={s} />{s.email}</span></TableCell><TableCell className="text-center">{s.role}</TableCell><TableCell className="text-center">{s.is_approved ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Approved</Badge> : <Badge variant="outline">Pending</Badge>}</TableCell><TableCell className="text-center">{s.last_synced_at ? new Date(s.last_synced_at).toLocaleString() : '—'}</TableCell><TableCell className="text-center"><LastOnline at={online.lastSeen} online={online.online} /></TableCell><TableCell className="text-right space-x-2"><Button size="sm" variant={s.is_approved ? 'destructive' : 'default'} onClick={() => handleApprovalToggle(s)}>{s.is_approved ? 'Disapprove' : 'Approve'}</Button><Button size="sm" variant="outline" onClick={() => openEdit(s)}>Edit</Button><Button size="sm" variant="ghost" onClick={async () => { try { const logs = await api.getAllApprovalLogs(); setSelectedLogs(logs.filter(l => l.target_id === s.id).slice(0,50)); setIsLogsDialogOpen(true); } catch (e) { toast.error('Failed to load logs'); } }}> <UserCog className="h-4 w-4"/> </Button></TableCell></TableRow>; })()
                  ))}
                </TableBody>
              </Table></CardContent>
      </Card>
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>{selectedUser && <StaffUserEditorDialog staffUser={selectedUser} onSuccess={handleEditSuccess} onClose={() => setIsEditDialogOpen(false)} currentUserId={currentUserId!} />}</Dialog>
      <Dialog open={isLogsDialogOpen} onOpenChange={setIsLogsDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Audit Logs</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            {selectedLogs.length === 0 ? (
              <p className="text-muted-foreground">No recent logs for this user.</p>
            ) : (
              <div className="space-y-3">
                {selectedLogs.map(l => (
                  <div key={l.id} className="border rounded p-2">
                    <div className="text-sm text-muted-foreground">{new Date(l.timestamp).toLocaleString()}</div>
                    <div className="font-medium">{l.action} — {l.target_type}</div>
                    <div className="text-sm">{l.description}</div>
                    <div className="text-xs text-muted-foreground">By: {l.actor_email}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgencyUserManagement;
