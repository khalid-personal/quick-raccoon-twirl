import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Mail, Phone } from 'lucide-react';
import { NewCandidateFormValues } from './schema';

interface LoginCredentialsSectionProps {
  form: UseFormReturn<NewCandidateFormValues>;
}

const LoginCredentialsSection: React.FC<LoginCredentialsSectionProps> = ({ form }) => {
  const { register, formState: { errors }, isSubmitting } = form;

  return (
    <>
      <h3 className="text-lg font-semibold border-b pb-2">Login & Contact Information</h3>
      
      {/* Email Input for Candidate Login */}
      <div className="space-y-2 pt-4">
        <Label htmlFor="email" className="flex items-center">
            <Mail className="h-4 w-4 mr-2" /> Candidate Email (Login) *
        </Label>
        <Input id="email" {...register('email')} placeholder="candidate@example.com" disabled={isSubmitting} />
        {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
      </div>
      
      {/* Phone Number Input */}
      <div className="space-y-2">
        <Label htmlFor="phone_number" className="flex items-center">
            <Phone className="h-4 w-4 mr-2" /> Phone Number (Optional)
        </Label>
        <Input id="phone_number" {...register('phone_number')} placeholder="+2519XXXXXXXX" disabled={isSubmitting} />
        {errors.phone_number && <p className="text-red-500 text-xs">{errors.phone_number.message}</p>}
      </div>
      
      <p className="text-xs text-muted-foreground mt-3 text-center">
        Default PIN for new candidates is <span className="font-mono font-semibold">123456</span>.
      </p>
      
      <Separator className="my-6" />
    </>
  );
};

export default LoginCredentialsSection;