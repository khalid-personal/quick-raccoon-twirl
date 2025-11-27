import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { StaffUser, STAFF_ROLES, UserRole } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle, XCircle, Save, UserCheck, UserX, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';

const AdminUserManagement: React.FC = () => {
  const { userRole, user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  
  // Role check and redirect
  if (isAuthLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (userRole !== 'admin') {
    toast.error("Access Denied: You must be a Superadmin to manage users.");
    return <Navigate to="/admin" replace />;
  }
  
  const currentUserId = user?.id;

  const { data: users = [], isLoading } = useQuery<StaffUser[]>({
    queryKey: ['staffUsers'],
    queryFn: api.getAllStaffUsers,
  });
  
  // State to track pending changes before saving
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, { role: Exclude<UserRole, 'candidate'>, is_approved: boolean }>>({});

  const mutation = useMutation({
    mutationFn: ({ userId, role, isApproved }: { userId: string, role: Exclude<UserRole, 'candidate'>, isApproved: boolean }) => {
      return api.updateUserRole(userId, role, isApproved);
    },
    onSuccess: (updatedUser) => {
      toast.success(`User ${updatedUser.email} updated successfully.`);
      // Clear pending update for this user
      setPendingUpdates(prev => {
        const newUpdates = { ...prev };
        delete newUpdates[updatedUser.id];
        return newUpdates;
      });
      queryClient.invalidateQueries({ queryKey: ['staffUsers'] });
    },
    onError: (error) => {
      toast.error(`Failed to update user: ${(error as Error).message}`);
    },
  });
  
  const handleRoleChange = (userId: string, newRole: Exclude<UserRole, 'candidate'>) => {
    const currentUser = users.find(u => u.id === userId);
    if (!currentUser) return;
    
    setPendingUpdates(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        role: newRole,
        is_approved: prev[userId]?.is_approved ?? currentUser.is_approved,
      },
    }));
  };
  
  const handleApprovalToggle = (userId: string, currentApprovalStatus: boolean) => {
    const currentUser = users.find(u => u.id === userId);
    if (!currentUser) return;
    
    const newApprovalStatus = !currentApprovalStatus;
    
    setPendingUpdates(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        role: prev[userId]?.role ?? currentUser.role,
        is_approved: newApprovalStatus,
      },
    }));
  };
  
  const handleSave = (userId: string) => {
    const update = pendingUpdates[userId];
    if (!update) return;
    
    if (userId === currentUserId && update.role !== 'admin') {
        if (!window.confirm("WARNING: You are about to demote yourself from 'admin'. You may lose access to this page. Proceed?")) {
            return;
        }
    }
    
    mutation.mutate({ userId, role: update.role, isApproved: update.is_approved });
  };
  
  const getEffectiveRole = (userId: string, currentRole: Exclude<UserRole, 'candidate'>) => {
      return pendingUpdates[userId]?.role ?? currentRole;
  };
  
  const getEffectiveApproval = (userId: string, currentApproval: boolean) => {
      return pendingUpdates[userId]?.is_approved ?? currentApproval;
  };
  
  const isUpdatePending = (userId: string) => {
      const currentUser = users.find(u => u.id === userId);
      if (!currentUser) return false;
      
      const effectiveRole = getEffectiveRole(userId, currentUser.role);
      const effectiveApproval = getEffectiveApproval(userId, currentUser.is_approved);
      
      return effectiveRole !== currentUser.role || effectiveApproval !== currentUser.is_approved;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 border-b pb-2">
        <UserCog className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Staff User Management</h1>
      </div>
      <p className="text-muted-foreground">Manage roles and approval status for all staff accounts (Admin, Staff, Viewer). New signups appear here as 'Pending' until approved.</p>

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
                  <TableHead>Current Role</TableHead>
                  <TableHead>Approval Status</TableHead>
                  <TableHead className="w-[200px]">Change Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((staffUser) => {
                  const effectiveRole = getEffectiveRole(staffUser.id, staffUser.role);
                  const effectiveApproval = getEffectiveApproval(staffUser.id, staffUser.is_approved);
                  const isSelf = staffUser.id === currentUserId;
                  
                  return (
                    <TableRow key={staffUser.id} className={isSelf ? "bg-blue-50/50 dark:bg-blue-950/50" : ""}>
                      <TableCell className="font-medium">
                        {staffUser.email} {isSelf && <Badge variant="secondary" className="ml-2">You</Badge>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {effectiveRole}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {effectiveApproval ? (
                          <Badge className="bg-green-500 hover:bg-green-600 text-white">
                            <CheckCircle className="h-3 w-3 mr-1" /> Approved
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500 hover:bg-red-600 text-white">
                            <XCircle className="h-3 w-3 mr-1" /> Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={effectiveRole}
                          onValueChange={(value: Exclude<UserRole, 'candidate'>) => handleRoleChange(staffUser.id, value)}
                          disabled={mutation.isPending || isSelf} // Prevent changing own role via select
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Role" />
                          </SelectTrigger>
                          <SelectContent>
                            {STAFF_ROLES.map(role => (
                              <SelectItem key={role} value={role}>
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {/* Approval Toggle Button */}
                        <Button
                            variant={effectiveApproval ? "destructive" : "default"}
                            size="sm"
                            onClick={() => handleApprovalToggle(staffUser.id, effectiveApproval)}
                            disabled={mutation.isPending || isSelf} // Prevent self-approval/disapproval
                            title={effectiveApproval ? "Disapprove User" : "Approve User"}
                        >
                            {effectiveApproval ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </Button>
                        
                        {/* Save Button */}
                        <Button 
                          size="sm" 
                          onClick={() => handleSave(staffUser.id)}
                          disabled={mutation.isPending || !isUpdatePending(staffUser.id)}
                          title="Save Changes"
                        >
                          {mutation.isPending && isUpdatePending(staffUser.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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
    </div>
  );
};

export default AdminUserManagement;