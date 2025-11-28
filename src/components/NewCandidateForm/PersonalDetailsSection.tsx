import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import PassportPhotoInput from '@/components/PassportPhotoInput';
import { NewCandidateFormValues } from './schema';

interface PersonalDetailsSectionProps {
  form: UseFormReturn<NewCandidateFormValues>;
  profileImageFile: File | null;
  setProfileImageFile: (file: File | null) => void;
  isSubmitting: boolean;
}

const PersonalDetailsSection: React.FC<PersonalDetailsSectionProps> = ({
  form,
  profileImageFile,
  setProfileImageFile,
  isSubmitting,
}) => {
  const { register, formState: { errors } } = form;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input id="first_name" {...register('first_name')} />
              {errors.first_name && <p className="text-red-500 text-xs">{errors.first_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input id="last_name" {...register('last_name')} />
              {errors.last_name && <p className="text-red-500 text-xs">{errors.last_name.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="passport_number">Passport Number *</Label>
              <Input id="passport_number" {...register('passport_number')} />
              {errors.passport_number && <p className="text-red-500 text-xs">{errors.passport_number.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth * (YYYY-MM-DD)</Label>
              <Input id="dob" type="date" {...register('dob')} />
              {errors.dob && <p className="text-red-500 text-xs">{errors.dob.message}</p>}
            </div>
          </div>
        </div>
        
        {/* Passport Photo Input */}
        <div className="md:col-span-1 flex justify-center items-start pt-4 md:pt-0">
          <PassportPhotoInput 
            value={profileImageFile} 
            onChange={setProfileImageFile} 
            disabled={isSubmitting}
          />
        </div>
      </div>
      
      <Separator className="my-6" />
    </>
  );
};

export default PersonalDetailsSection;