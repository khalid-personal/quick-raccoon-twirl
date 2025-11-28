import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { StaffUser, STAFF_ROLES, UserRole } from '@/lib/types';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Save, Mail, Lock, UserCog, Building, Landmark } from 'lucide-react'; // Added Landmark icon
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth'; // Import useAuth

const EditStaffSchema = z.object({
  email: z.string().email("Must be a valid email address."),
  role: z.enum(STAFF_ROLES as [string, ...string[]]),
  new_pin: z.string().optional().refine(
    (val) => !val || val.length >= 6,
    "PIN must be at least 6 characters long."
  ),
  foreign_agency: z.string().optional(),
  coc_agency_name: z.string().optional(), // NEW FIELD
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
    cocAgencies: string[];
    foreignAgencies: string[];
    localAgencies: string[]; // NEW
}

const StaffUserEditorDialog: React.FC<StaffUserEditorDialogProps> = ({ staffUser, onSuccess, onClose, currentUserId }) => {
  const { user } = useAuth(); // Get current user for logging
  const actorId = user?.id || 'unknown-admin';
  const actorEmail = user?.email || 'unknown-admin@agency.com';

  const isSelf = staffUser.id === currentUserId;
  
  const { data: config, isLoading: isLoadingConfig } = useQuery<AppConfig>({
    queryKey: ['appConfig'],
    queryFn: api.getAppConfig,
    initialData: { countryOptions: [], cocAgencies: [], foreignAgencies: [], localAgencies: [] },
  });
  const foreignAgencies = config.foreignAgencies;
  const localAgencies = config.localAgencies; // NEW

  const form = useForm<EditStaffFormValues>({
    resolver: zodResolver(EditStaffSchema),
    defaultValues: {
      email: staffUser.email,
      role: staffUser.role,
      new_pin: '',
      foreign_agency: staffUser.foreign_agency || '',
      coc_agency_name: staffUser.coc_agency_name || '', // Initialize
    },
  });

  const { register, handleSubmit, formState: { errors, isSubmitting }, watch, setValue } = form;
  const newPin = watch('new_pin');
  const selectedRole = watch('role');

  const onSubmit = async (data: EditStaffFormValues) => {
    try {
      // Check if role or agency associations changed
      const roleChanged = data.role !== staffUser.role;
      const foreignAgencyChanged = data.foreign_agency !== (staffUser.foreign_agency || '');
      const cocAgencyNameChanged = data.coc_agency_name !== (staffUser.coc_agency_name || ''); // NEW

      if (roleChanged) {
        if (isSelf && data.role !== 'admin') {
            if (!window.confirm("WARNING: You are about to demote yourself from 'admin'. You may lose access to user management. Proceed?")) {
                return;
            }
        }
        await api.updateUserRole(staffUser.id, data.role, staffUser.is_approved, actorId, actorEmail);
      }
      
      // Update Credentials (Email/PIN) and Agency Associations if changed
      if (data.email !== staffUser.email || newPin || foreignAgencyChanged || cocAgencyNameChanged) { // NEW condition
        await api.updateUserCredentials(
            staffUser.id, 
            data.email, 
            newPin, 
            data.foreign_agency || undefined,
            data.coc_agency_name || undefined, // Pass COC agency name
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
            onValueChange={(value: Exclude<UserRole, 'candidate'>) => setValue('role', value, { shouldValidate: true })}
            disabled={isSubmitting || isSelf} // Prevent self-demotion via select
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
            <Label htmlFor="foreign_agency" className="flex items-center">
              <Building className="h-4 w-4 mr-2" /> Associated Foreign Agency *
            </Label>
            <Select
              value={watch('foreign_agency')}
              onValueChange={(value) => setValue('foreign_agency', value, { shouldValidate: true })}
              disabled={isSubmitting || foreignAgencies.length === 0}
            >
              <SelectTrigger id="foreign_agency">
                <SelectValue placeholder="Select Agency" />
              </SelectTrigger>
              <SelectContent>
                {foreignAgencies.map(agency => (
                  <SelectItem key={agency} value={agency}>
                    {agency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.foreign_agency && <p className="text-red-500 text-xs mt-1">{errors.foreign_agency.message}</p>}
          </div>
        )}

        {/* COC Agency Selection (Only for 'local-agency' role) */}
        {selectedRole === 'local-agency' && (
          <div className="space-y-2 pl-4 border-l-2 border-green-500"> {/* Different border color for local agency */}
            <Label htmlFor="coc_agency_name" className="flex items-center">
              <Landmark className="h-4 w-4 mr-2" /> Associated Local Agency (COC) *
            </Label>
            <Select
              value={watch('coc_agency_name')}
              onValueChange={(value) => setValue('coc_agency_name', value, { shouldValidate: true })}
              disabled={isSubmitting || localAgencies.length === 0}
            >
              <SelectTrigger id="coc_agency_name">
                <SelectValue placeholder="Select Local Agency" />
              </SelectTrigger>
              <SelectContent>
                {localAgencies.map(agency => (
                  <SelectItem key={agency} value={agency}>
                    {agency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.coc_agency_name && <p className="text-red-500 text-xs mt-1">{errors.coc_agency_name.message}</p>}
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