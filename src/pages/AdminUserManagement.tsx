import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { StaffUser, STAFF_ROLES, UserRole } from '@/lib/types';
import { LastOnline } from '@/components/LastOnline';
import UserAvatar from '@/components/UserAvatar';
import { usePresence } from '@/hooks/use-presence';
import { presenceFor } from '@/lib/presence';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle, XCircle, Save, UserCheck, UserX, UserCog, Pencil, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import StaffUserEditorDialog from '@/components/StaffUserEditorDialog';
import NewStaffUserForm from '@/components/NewStaffUserForm'; // NEW IMPORT

const AdminUserManagement: React.FC = () => {
  const { userRole, user, isLoading: isAuthLoading, logout } = useAuth();
  const presence = usePresence();
  const queryClient = useQueryClient();
  
  // State for the editor dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false); // NEW state for Add dialog
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  
  const currentUserId = user?.id;
  const actorId = user?.id || 'unknown-admin';
  const actorEmail = user?.email || 'unknown-admin@agency.com';

  const { data: users = [], isLoading, refetch } = useQuery<StaffUser[]>({
    queryKey: ['staffUsers'],
    queryFn: api.getAllStaffUsers,
    enabled: !isAuthLoading && userRole === 'admin',
  });
  
  // Mutation for quick approval/disapproval toggle
  const approvalMutation = useMutation({
    mutationFn: ({ userId, role, isApproved }: { userId: string, role: Exclude<UserRole, 'candidate'>, isApproved: boolean }) => {
      return api.updateUserRole(userId, role, isApproved, actorId, actorEmail);
    },
    onSuccess: (updatedUser) => {
      toast.success(`User ${updatedUser.email} approval status updated.`);
      queryClient.invalidateQueries({ queryKey: ['staffUsers'] });
      
      // If the admin just disapproved themselves, force logout
      if (updatedUser.id === currentUserId && !updatedUser.is_approved) {
          logout();
      }
    },
    onError: (error) => {
      toast.error(`Failed to update approval status: ${(error as Error).message}`);
    },
  });
  
  const handleApprovalToggle = (staffUser: StaffUser) => {
    const newApprovalStatus = !staffUser.is_approved;
    
    if (staffUser.id === currentUserId && !newApprovalStatus) {
        if (!window.confirm("WARNING: You are about to disapprove your own account. You will be logged out immediately. Proceed?")) {
            return;
        }
    }
    
    approvalMutation.mutate({ 
        userId: staffUser.id, 
        role: staffUser.role, 
        isApproved: newApprovalStatus 
    });
  };
  
  const handleOpenEdit = (staffUser: StaffUser) => {
      setSelectedUser(staffUser);
      setIsEditDialogOpen(true);
  };
  
  const handleEditSuccess = () => {
      refetch();
  };
  
  const handleAddSuccess = () => {
      refetch();
      setIsAddDialogOpen(false);
  };

  if (isAuthLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (userRole !== 'superadmin') {
    toast.error("Access Denied: You must be a Superadmin to manage users.");
    return <Navigate to="/admin" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center space-x-3">
            <UserCog className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Staff User Management</h1>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
                <Button>
                    <UserPlus className="h-4 w-4 mr-2" /> Add New User
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Create New Staff Account</DialogTitle>
                </DialogHeader>
                <NewStaffUserForm 
                    onSuccess={handleAddSuccess} 
                    onClose={() => setIsAddDialogOpen(false)} 
                />
            </DialogContent>
        </Dialog>
      </div>
      <p className="text-muted-foreground">Manage roles, approval status, and credentials for all staff accounts. New signups appear here as 'Pending' until approved.</p>

      <Card>
        <CardHeader>
          <CardTitle>Registered Staff Accounts ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Approval Status</TableHead>
                  <TableHead>Last Online</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((staffUser) => {
                  const isSelf = staffUser.id === currentUserId;
                  const online = presenceFor(presence, 'staff', staffUser.id, staffUser.last_online_at);
                  
                  return (
                    <TableRow key={staffUser.id} className={isSelf ? "bg-blue-50/50 dark:bg-blue-950/50" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3"><UserAvatar user={staffUser} /><span>{staffUser.email} {isSelf && <Badge variant="secondary" className="ml-2">You</Badge>}</span></div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {staffUser.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {staffUser.is_approved ? (
                          <Badge className="bg-green-500 hover:bg-green-600 text-white">
                            <CheckCircle className="h-3 w-3 mr-1" /> Approved
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500 hover:bg-red-600 text-white">
                            <XCircle className="h-3 w-3 mr-1" /> Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell><LastOnline at={online.lastSeen} online={online.online} /></TableCell>
                      <TableCell className="text-right space-x-2">
                        {/* Approval Toggle Button */}
                        <Button
                            variant={staffUser.is_approved ? "destructive" : "default"}
                            size="sm"
                            onClick={() => handleApprovalToggle(staffUser)}
                            disabled={approvalMutation.isPending || isSelf} // Prevent self-approval/disapproval
                            title={staffUser.is_approved ? "Disapprove User" : "Approve User"}
                        >
                            {approvalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : staffUser.is_approved ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </Button>
                        
                        {/* Edit Button */}
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleOpenEdit(staffUser)}
                          disabled={approvalMutation.isPending}
                          title="Edit Credentials and Role"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      {/* Edit Staff User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        {selectedUser && (
            <StaffUserEditorDialog
                staffUser={selectedUser}
                onSuccess={handleEditSuccess}
                onClose={() => setIsEditDialogOpen(false)}
                currentUserId={currentUserId!}
            />
        )}
      </Dialog>
    </div>
  );
};

export default AdminUserManagement;