import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NewCandidateFormValues } from './schema';

interface LoginCredentialsSectionProps {
  form: UseFormReturn<NewCandidateFormValues>;
}

const LoginCredentialsSection: React.FC<LoginCredentialsSectionProps> = ({ form }) => {
  const { register, formState: { errors } } = form;

  return (
    <>
      <h3 className="text-lg font-semibold border-b pb-2">Candidate Login Credentials</h3>

      {/* Email Input for Candidate Login */}
      <div className="space-y-2">
        <Label htmlFor="email">Candidate Email (Login) *</Label>
        <Input id="email" {...register('email')} placeholder="candidate@example.com" />
        {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
      </div>
      
      {/* Phone Number Input */}
      <div className="space-y-2">
        <Label htmlFor="phone_number">Phone Number (Optional)</Label>
        <Input id="phone_number" {...register('phone_number')} placeholder="+2519XXXXXXXX" />
        {errors.phone_number && <p className="text-red-500 text-xs">{errors.phone_number.message}</p>}
      </div>
    </>
  );
};

export default LoginCredentialsSection;