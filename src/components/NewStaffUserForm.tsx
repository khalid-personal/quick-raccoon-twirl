import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, UserPlus, Mail, Lock, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STAFF_ROLES, UserRole } from '@/lib/types';
import { useAuth } from '@/lib/auth';

const NewStaffUserSchema = z.object({
  email: z.string().email("Must be a valid email address."),
  role: z.enum(STAFF_ROLES as [string, ...string[]], {
    required_error: "Role is required.",
  }),
  pin: z.string().min(6, "PIN must be at least 6 characters long."),
});

type NewStaffUserFormValues = z.infer<typeof NewStaffUserSchema>;

interface NewStaffUserFormProps {
  onSuccess: () => void;
  onClose: () => void;
}

const NewStaffUserForm: React.FC<NewStaffUserFormProps> = ({ onSuccess, onClose }) => {
  const { user } = useAuth();
  const actorId = user?.id || 'unknown';
  const actorEmail = user?.email || 'unknown@agency.com';
  
  const form = useForm<NewStaffUserFormValues>({
    resolver: zodResolver(NewStaffUserSchema),
    defaultValues: {
      email: '',
      role: 'staff',
      pin: '123456',
    },
  });

  const { register, handleSubmit, formState: { errors, isSubmitting }, watch, setValue } = form;

  const onSubmit = async (data: NewStaffUserFormValues) => {
    try {
      // Pass actor details for logging
      await api.createStaffUser(data.email, data.pin, data.role as Exclude<UserRole, 'candidate' | 'agency'>, actorId, actorEmail);
      
      toast.success(`Staff user ${data.email} created successfully with role: ${data.role}.`);
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(`Failed to create user: ${(error as Error).message}`);
    }
  };

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
          value={watch('role')}
          onValueChange={(value: Exclude<UserRole, 'candidate' | 'agency'>) => setValue('role', value, { shouldValidate: true })}
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
          Register Account
        </Button>
      </DialogFooter>
    </form>
  );
};

export default NewStaffUserForm;