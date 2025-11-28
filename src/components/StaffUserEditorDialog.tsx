import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { StaffUser, STAFF_ROLES, UserRole } from '@/lib/types';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Save, Mail, Lock, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/auth';

const EditStaffSchema = z.object({
  email: z.string().email("Must be a valid email address."),
  role: z.enum(STAFF_ROLES as [string, ...string[]]),
  new_pin: z.string().optional().refine(
    (val) => !val || val.length >= 6,
    "PIN must be at least 6 characters long."
  ),
});

type EditStaffFormValues = z.infer<typeof EditStaffSchema>;

interface StaffUserEditorDialogProps {
  staffUser: StaffUser;
  onSuccess: () => void;
  onClose: () => void;
  currentUserId: string;
}

const StaffUserEditorDialog: React.FC<StaffUserEditorDialogProps> = ({ staffUser, onSuccess, onClose, currentUserId }) => {
  const { user } = useAuth();
  const actorId = user?.id || 'unknown';
  const actorEmail = user?.email || 'unknown@agency.com';
  
  const isSelf = staffUser.id === currentUserId;
  
  const form = useForm<EditStaffFormValues>({
    resolver: zodResolver(EditStaffSchema),
    defaultValues: {
      email: staffUser.email,
      role: staffUser.role,
      new_pin: '',
    },
  });

  const { register, handleSubmit, formState: { errors, isSubmitting }, watch, setValue } = form;
  const newPin = watch('new_pin');

  const onSubmit = async (data: EditStaffFormValues) => {
    try {
      // 1. Update Role (if changed)
      if (data.role !== staffUser.role) {
        if (isSelf && data.role !== 'admin') {
            if (!window.confirm("WARNING: You are about to demote yourself from 'admin'. You may lose access to user management. Proceed?")) {
                return;
            }
        }
        // Pass actor details for logging
        await api.updateUserRole(staffUser.id, data.role as Exclude<UserRole, 'candidate'>, staffUser.is_approved, actorId, actorEmail);
      }
      
      // 2. Update Credentials (Email/PIN)
      if (data.email !== staffUser.email || data.new_pin) {
        // Pass actor details for logging
        await api.updateUserCredentials(staffUser.id, data.email, data.new_pin, actorId, actorEmail);
        toast.success(`Credentials for ${data.email} updated successfully.`);
      } else if (data.role !== staffUser.role) {
        toast.success(`Role for ${staffUser.email} updated successfully.`);
      } else {
        toast.info("No changes detected.");
        onClose();
        return;
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(`Failed to update user: ${(error as Error).message}`);
    }
  };

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>Edit Staff Account: {staffUser.email}</DialogTitle>
      </DialogHeader>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
        
        {/* Role Management (Always visible) */}
        <div className="space-y-2">
          <Label htmlFor="role" className="flex items-center">
            <UserCog className="h-4 w-4 mr-2" /> Account Role
          </Label>
          <Select
            value={watch('role')}
            onValueChange={(value: Exclude<UserRole, 'candidate'>) => setValue('role', value, { shouldValidate: true })}
            disabled={isSubmitting || isSelf}
          >
            <SelectTrigger id="role">
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
          {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role.message}</p>}
          {isSelf && <p className="text-xs text-muted-foreground mt-1">You cannot change your own role via this dropdown.</p>}
        </div>
        
        <Separator />
        
        {/* Credentials Management */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Credentials</h3>
          
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center">
              <Mail className="h-4 w-4 mr-2" /> Email
            </Label>
            <Input id="email" {...register('email')} disabled={isSubmitting} />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="new_pin" className="flex items-center">
              <Lock className="h-4 w-4 mr-2" /> Reset PIN (Leave blank to keep current)
            </Label>
            <Input 
              id="new_pin" 
              type="password" 
              placeholder="••••••"
              {...register('new_pin')} 
              disabled={isSubmitting}
            />
            {errors.new_pin && <p className="text-red-500 text-xs mt-1">{errors.new_pin.message}</p>}
            <p className="text-xs text-muted-foreground">
              If changed, the user must use this new PIN/Password for login.
            </p>
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

export default StaffUserEditorDialog;