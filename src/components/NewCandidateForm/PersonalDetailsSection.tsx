import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import PassportPhotoInput from '@/components/PassportPhotoInput';
import { NewCandidateFormValues, MARITAL_STATUS_OPTIONS } from './schema';

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
  const { register, formState: { errors }, watch, setValue } = form;

  return (
    <>
      <h3 className="text-lg font-semibold border-b pb-2">Personal Details</h3>
      
      <div className="flex flex-col items-center space-y-4 py-4">
        <PassportPhotoInput
          value={profileImageFile}
          onChange={setProfileImageFile}
          disabled={isSubmitting}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="first_name">First Name *</Label>
          <Input id="first_name" {...register('first_name')} disabled={isSubmitting} />
          {errors.first_name && <p className="text-red-500 text-xs">{errors.first_name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Last Name *</Label>
          <Input id="last_name" {...register('last_name')} disabled={isSubmitting} />
          {errors.last_name && <p className="text-red-500 text-xs">{errors.last_name.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dob">Date of Birth * (YYYY-MM-DD)</Label>
          <Input id="dob" type="date" {...register('dob')} disabled={isSubmitting} />
          {errors.dob && <p className="text-red-500 text-xs">{errors.dob.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="marital_status">Marital Status *</Label>
          <Select
            value={watch('marital_status')}
            onValueChange={(value) => setValue('marital_status', value, { shouldValidate: true })}
            disabled={isSubmitting}
          >
            <SelectTrigger id="marital_status">
              <SelectValue placeholder="Select Status" />
            </SelectTrigger>
            <SelectContent>
              {MARITAL_STATUS_OPTIONS.map(status => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.marital_status && <p className="text-red-500 text-xs">{errors.marital_status.message}</p>}
        </div>
      </div>
      
      <Separator className="my-6" />
    </>
  );
};

export default PersonalDetailsSection;