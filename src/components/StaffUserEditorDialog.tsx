import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { StaffUser, STAFF_ROLES, UserRole, ForeignAgency, LocalAgency } from '@/lib/types'; // NEW IMPORT
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Save, Mail, Lock, UserCog, Building, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';

const EditStaffSchema = z.object({
  email: z.string().email("Must be a valid email address."),
  role: z.enum(STAFF_ROLES as [string, ...string[]]),
  new_pin: z.string().optional().refine(
    (val) => !val || val.length >= 6,
    "PIN must be at least 6 characters long."
  ),
  foreign_agency_id: z.string().optional(), // Changed to ID
  local_agency_id: z.string().optional(), // Changed to ID
});

type EditStaffFormValues = z.infer<typeof EditStaffSchema>;

interface StaffUserEditorDialogProps {
  staffUser: StaffUser;
  onSuccess: () => void;
  onClose: () => void;
  currentUserId: string;
}

interface AppConfig {
    countryOptions: string[];
    cocFacilities: string[]; // Changed
    foreignAgencies: ForeignAgency[]; // Changed
    localAgencies: LocalAgency[]; // Changed
}

const StaffUserEditorDialog: React.FC<StaffUserEditorDialogProps> = ({ staffUser, onSuccess, onClose, currentUserId }) => {
  const { user } = useAuth();
  const actorId = user?.id || 'unknown-admin';
  const actorEmail = user?.email || 'unknown-admin@agency.com';

  const isSelf = staffUser.id === currentUserId;
  
  const { data: config, isLoading: isLoadingConfig } = useQuery<AppConfig>({
    queryKey: ['appConfig'],
    queryFn: api.getAppConfig,
    initialData: { countryOptions: [], cocFacilities: [], foreignAgencies: [], localAgencies: [] }, // Updated initialData
  });
  const foreignAgencies = config.foreignAgencies;
  const localAgencies = config.localAgencies;

  const form = useForm<EditStaffFormValues>({
    resolver: zodResolver(EditStaffSchema),
    defaultValues: {
      email: staffUser.email,
      role: staffUser.role,
      new_pin: '',
      foreign_agency_id: staffUser.foreign_agency_id || '', // Initialize with ID
      local_agency_id: staffUser.local_agency_id || '', // Initialize with ID
    },
  });

  const { register, handleSubmit, formState: { errors, isSubmitting }, watch, setValue } = form;
  const newPin = watch('new_pin');
  const selectedRole = watch('role');

  const onSubmit = async (data: EditStaffFormValues) => {
    try {
      // Check if role or agency associations changed
      const roleChanged = data.role !== staffUser.role;
      const foreignAgencyChanged = data.foreign_agency_id !== (staffUser.foreign_agency_id || ''); // Changed
      const localAgencyChanged = data.local_agency_id !== (staffUser.local_agency_id || ''); // Changed

      if (roleChanged) {
        if (isSelf && data.role !== 'admin') {
            if (!window.confirm("WARNING: You are about to demote yourself from 'admin'. You may lose access to user management. Proceed?")) {
                return;
            }
        }
        await api.updateUserRole(staffUser.id, data.role as Exclude<UserRole, 'candidate'>, staffUser.is_approved, actorId, actorEmail);
      }
      
      // Update Credentials (Email/PIN) and Agency Associations if changed
      if (data.email !== staffUser.email || newPin || foreignAgencyChanged || localAgencyChanged) { // Changed
        await api.updateUserCredentials(
            staffUser.id, 
            data.email, 
            newPin, 
            data.foreign_agency_id || undefined, // Use ID
            data.local_agency_id || undefined, // Use ID
            actorId,
            actorEmail
        );
        toast.success(`Credentials for ${data.email} updated successfully.`);
      } else if (roleChanged) {
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
  
  if (isLoadingConfig) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

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
            value={selectedRole}
            onValueChange={(value: Exclude<UserRole, 'candidate'>) => {
              setValue('role', value, { shouldValidate: true });
              // Clear agency fields if role changes
              if (value !== 'agency') setValue('foreign_agency_id', ''); // Clear ID
              if (value !== 'local-agency') setValue('local_agency_id', ''); // Clear ID
            }}
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
        
        {/* Foreign Agency Selection (Only for 'agency' role) */}
        {selectedRole === 'agency' && (
          <div className="space-y-2 pl-4 border-l-2 border-primary">
            <Label htmlFor="foreign_agency_id" className="flex items-center">
              <Building className="h-4 w-4 mr-2" /> Associated Foreign Agency *
            </Label>
            <Select
              value={watch('foreign_agency_id')}
              onValueChange={(value) => setValue('foreign_agency_id', value, { shouldValidate: true })}
              disabled={isSubmitting || foreignAgencies.length === 0}
            >
              <SelectTrigger id="foreign_agency_id">
                <SelectValue placeholder="Select Agency" />
              </SelectTrigger>
              <SelectContent>
                {foreignAgencies.map(agency => (
                  <SelectItem key={agency.id} value={agency.id}>
                    {agency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.foreign_agency_id && <p className="text-red-500 text-xs mt-1">{errors.foreign_agency_id.message}</p>}
          </div>
        )}

        {/* Local Agency Selection (Only for 'local-agency' role) */}
        {selectedRole === 'local-agency' && (
          <div className="space-y-2 pl-4 border-l-2 border-green-500">
            <Label htmlFor="local_agency_id" className="flex items-center">
              <Landmark className="h-4 w-4 mr-2" /> Associated Local Agency *
            </Label>
            <Select
              value={watch('local_agency_id')}
              onValueChange={(value) => setValue('local_agency_id', value, { shouldValidate: true })}
              disabled={isSubmitting || localAgencies.length === 0}
            >
              <SelectTrigger id="local_agency_id">
                <SelectValue placeholder="Select Local Agency" />
              </SelectTrigger>
              <SelectContent>
                {localAgencies.map(agency => (
                  <SelectItem key={agency.id} value={agency.id}>
                    {agency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.local_agency_id && <p className="text-red-500 text-xs mt-1">{errors.local_agency_id.message}</p>}
          </div>
        )}
        
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