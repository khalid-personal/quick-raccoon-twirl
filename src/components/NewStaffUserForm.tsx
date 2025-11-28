import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, UserPlus, Mail, Lock, UserCog, Building, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STAFF_ROLES, UserRole } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';

const NewStaffUserSchema = z.object({
  email: z.string().email("Must be a valid email address."),
  role: z.enum(STAFF_ROLES as [string, ...string[]], {
    required_error: "Role is required.",
  }),
  pin: z.string().min(6, "PIN must be at least 6 characters long."),
  foreign_agency: z.string().optional(),
  coc_agency_name: z.string().optional(),
});

type NewStaffUserFormValues = z.infer<typeof NewStaffUserSchema>;

interface NewStaffUserFormProps {
  onSuccess: () => void;
  onClose: () => void;
}

interface AppConfig {
    countryOptions: string[];
    cocAgencies: string[];
    foreignAgencies: string[];
    localAgencies: string[];
}

const NewStaffUserForm: React.FC<NewStaffUserFormProps> = ({ onSuccess, onClose }) => {
  const { user } = useAuth();
  const actorId = user?.id || 'unknown-admin';
  const actorEmail = user?.email || 'unknown-admin@agency.com';

  const { data: config, isLoading: isLoadingConfig } = useQuery<AppConfig>({
    queryKey: ['appConfig'],
    queryFn: api.getAppConfig,
    initialData: { countryOptions: [], cocAgencies: [], foreignAgencies: [], localAgencies: [] },
  });
  const foreignAgencies = config.foreignAgencies;
  const localAgencies = config.localAgencies;

  const form = useForm<NewStaffUserFormValues>({
    resolver: zodResolver(NewStaffUserSchema),
    defaultValues: {
      email: '',
      role: 'staff',
      pin: '123456',
      foreign_agency: '',
      coc_agency_name: '',
    },
  });

  const { register, handleSubmit, formState: { errors, isSubmitting }, watch, setValue } = form;
  const selectedRole = watch('role');

  const onSubmit = async (data: NewStaffUserFormValues) => {
    try {
      await api.createStaffUser(
        data.email, 
        data.pin, 
        data.role as Exclude<UserRole, 'candidate'>, // Cast to correct type
        data.foreign_agency || undefined,
        data.coc_agency_name || undefined,
        actorId,
        actorEmail
      );
      
      toast.success(`Staff user ${data.email} created successfully with role: ${data.role}.`);
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(`Failed to create user: ${(error as Error).message}`);
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
      
      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email" className="flex items-center">
          <Mail className="h-4 w-4 mr-2" /> Email *
        </Label>
        <Input id="email" {...register('email')} placeholder="new.staff@agency.com" disabled={isSubmitting} />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
      </div>
      
      {/* Role Selection */}
      <div className="space-y-2">
        <Label htmlFor="role" className="flex items-center">
          <UserCog className="h-4 w-4 mr-2" /> Account Role *
        </Label>
        <Select
          value={selectedRole}
          onValueChange={(value: Exclude<UserRole, 'candidate'>) => {
            setValue('role', value, { shouldValidate: true });
            // Clear agency fields if role changes
            if (value !== 'agency') setValue('foreign_agency', '');
            if (value !== 'local-agency') setValue('coc_agency_name', '');
          }}
          disabled={isSubmitting}
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
        <div className="space-y-2 pl-4 border-l-2 border-green-500">
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
      
      {/* Initial PIN */}
      <div className="space-y-2">
        <Label htmlFor="pin" className="flex items-center">
          <Lock className="h-4 w-4 mr-2" /> Initial PIN *
        </Label>
        <Input 
          id="pin" 
          type="password" 
          placeholder="••••••"
          {...register('pin')} 
          disabled={isSubmitting}
        />
        {errors.pin && <p className="text-red-500 text-xs mt-1">{errors.pin.message}</p>}
        <p className="text-xs text-muted-foreground">
          The user will use this PIN/Password for their first login.
        </p>
      </div>

      <DialogFooter className="pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
          Create Staff Account
        </Button>
      </DialogFooter>
    </form>
  );
};

export default NewStaffUserForm;