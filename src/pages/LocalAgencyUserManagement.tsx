import { LastOnline } from '@/components/LastOnline';
import UserAvatar from '@/components/UserAvatar';
import { usePresence } from '@/hooks/use-presence';
import { presenceFor } from '@/lib/presence';
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api/index';
import type { StaffUser, UserRole, ApprovalLog } from '@/lib/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/page/PageHeader';
import StatCards from '@/components/page/StatCards';
import FilterBar from '@/components/page/FilterBar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { CheckCircle, XCircle, UserCheck, UserX, Pencil, UserPlus } from 'lucide-react';
// ApprovalLog type imported above
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { Navigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import StaffUserEditorDialog from '@/components/StaffUserEditorDialog';
import NewStaffUserForm from '@/components/NewStaffUserForm';
import { hasRole } from '@/lib/utils/role-utils';

const LocalAgencyUserManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { userRole, userLocalAgencyId, user, isLoading: isAuthLoading } = useAuth();
  const presence = usePresence();

  const actorId = user?.id || '';
  const actorEmail = user?.email || '';
  const currentUserId = user?.id || null; // Define currentUserId

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);

  const { data: users = [], isLoading } = useQuery<StaffUser[]>({
    queryKey: ['staffUsers'],
    queryFn: api.getAllStaffUsers, // Corrected function name
  });

  const localUsers = users.filter(u => u.local_agency_id === userLocalAgencyId);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return localUsers.filter(item => {
      if (filter === 'approved' && !item.is_approved) return false;
      if (filter === 'pending' && item.is_approved) return false;
      return !term || `${item.email} ${item.role}`.toLowerCase().includes(term);
    });
  }, [localUsers, search, filter]);

  const [isLogsDialogOpen, setIsLogsDialogOpen] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState<ApprovalLog[]>([]);

  const approvalMutation = useMutation({
    mutationFn: ({ userId, role, isApproved }: { userId: string, role: Exclude<UserRole,'candidate'>, isApproved: boolean }) => {
      return api.updateUserRole(userId, role, isApproved, actorId, actorEmail, userRole ?? undefined, undefined, userLocalAgencyId ?? undefined);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staffUsers'] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const handleApprovalToggle = (staffUser: StaffUser) => {
    approvalMutation.mutate({ userId: staffUser.id, role: staffUser.role, isApproved: !staffUser.is_approved });
  };

  const openEdit = (u: StaffUser) => { setSelectedUser(u); setIsEditDialogOpen(true); };
  const handleAddSuccess = () => { queryClient.invalidateQueries({ queryKey: ['staffUsers'] }); setIsAddDialogOpen(false); };
  const handleEditSuccess = () => { queryClient.invalidateQueries({ queryKey: ['staffUsers'] }); setIsEditDialogOpen(false); };

  if (isAuthLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!hasRole(userRole, ['local-agency'])) {
    toast.error('Access Denied: You do not have permission to view this page.');
    return <Navigate to="/login" replace />;
  }

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  

  return (
    <div className="space-y-6">
      <PageHeader
        title="Local Agency Staff Management"
        description="Approve and manage the people who sign in on behalf of your agency."
        actions={<Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 mr-2" /> Add Staff</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle>Create New Staff for Your Agency</DialogTitle></DialogHeader>
            <NewStaffUserForm onSuccess={handleAddSuccess} onClose={() => setIsAddDialogOpen(false)} defaultRole={'staff'} defaultLocalAgencyId={userLocalAgencyId!} />
          </DialogContent>
        </Dialog>}
      />

      <StatCards items={[
        { label: 'Staff', value: localUsers.length, onClick: () => setFilter('all'), active: filter === 'all' },
        { label: 'Approved', value: localUsers.filter(item => item.is_approved).length, onClick: () => setFilter(filter === 'approved' ? 'all' : 'approved'), active: filter === 'approved' },
        { label: 'Pending approval', value: localUsers.filter(item => !item.is_approved).length, onClick: () => setFilter(filter === 'pending' ? 'all' : 'pending'), active: filter === 'pending' },
      ]} />

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Staff</CardTitle>
          <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search email or role" filters={[['all', 'All'], ['approved', 'Approved'], ['pending', 'Pending']]} filter={filter} onFilterChange={setFilter} />
        </CardHeader>
        <CardContent>
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Approval Status</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Last Online</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleUsers.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No staff match.</TableCell></TableRow>}
                {visibleUsers.map(s => {
                  const online = presenceFor(presence, 'staff', s.id, s.last_online_at);
                  return <TableRow key={s.id} className={s.id === currentUserId ? 'bg-blue-50/50' : ''}>
                    <TableCell className="py-2"><div className="flex items-center gap-3"><UserAvatar user={s} /><span>{s.email} {s.id === currentUserId && <Badge variant="secondary"><span className="ml-2">You</span></Badge>}</span></div></TableCell>
                    <TableCell className="text-center">{s.role}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center gap-2 justify-center">
                        {s.is_approved ? <Badge variant="secondary"><span className="bg-green-500 text-white flex items-center"><CheckCircle className="h-3 w-3 mr-1" /> Approved</span></Badge> : <Badge variant="secondary"><span className="bg-red-500 text-white flex items-center"><XCircle className="h-3 w-3 mr-1" /> Pending</span></Badge>}

                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-center">{s.last_synced_at ? new Date(s.last_synced_at).toLocaleString() : '—'}</TableCell>
                    <TableCell className="text-sm text-center"><LastOnline at={online.lastSeen} online={online.online} /></TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant={s.is_approved ? 'destructive' : 'default'} onClick={() => handleApprovalToggle(s)} disabled={s.id === currentUserId}>{s.is_approved ? 'Disapprove' : 'Approve'}</Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(s)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={async () => {
                        try {
                          const logs = await api.getAllApprovalLogs();
                          const filtered = logs.filter(l => l.target_id === s.id).slice(0,50);
                          setSelectedLogs(filtered);
                          setIsLogsDialogOpen(true);
                        } catch (e) {
                          toast.error('Failed to load logs');
                        }
                      }}>View Logs</Button>
                    </TableCell>
                  </TableRow>;
                })}
              </TableBody>
            </Table></CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        {selectedUser && <StaffUserEditorDialog staffUser={selectedUser} onSuccess={handleEditSuccess} onClose={() => setIsEditDialogOpen(false)} currentUserId={currentUserId!} />}
      </Dialog>
      {/* Logs Dialog */}
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

export default LocalAgencyUserManagement;
