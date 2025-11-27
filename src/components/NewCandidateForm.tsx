import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogFooter } from '@/components/ui/dialog';
import { Candidate } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';

const NEW_BATCH_OPTION = '___NEW_BATCH___';
const NO_BATCH_OPTION = '___NO_BATCH___'; // Non-empty string constant for 'No Batch'

// Helper function to check if DOB is 18+
const isAdult = (dob: string): boolean => {
    const birthDate = new Date(dob);
    const ageDiffMs = Date.now() - birthDate.getTime();
    const ageDate = new Date(ageDiffMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970) >= 18;
};

// Schema for form validation
const NewCandidateSchema = z.object({
  first_name: z.string().min(1, "First name is required."),
  last_name: z.string().min(1, "Last name is required."),
  dob: z.string().min(1, "Date of Birth is required."),
  passport_number: z.string().min(1, "Passport number is required."),
  tracking_code: z.string().min(1, "Tracking code is required.").regex(/^TRK-[A-Z]{2,3}-\d{4,}$/, "Invalid tracking code format (e.g., TRK-ET-0001)."),
  country_of_origin: z.string().min(1, "Country of origin is required."),
  custom_country: z.string().optional(), // For 'Other' selection
  batch_name: z.string().optional(), // New field
  new_batch_name: z.string().optional(), // For creating a new batch
}).superRefine((data, ctx) => {
  // Age validation
  if (data.dob && !isAdult(data.dob)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Candidate must be 18 years or older.",
      path: ['dob'],
    });
  }
  
  if (data.country_of_origin === 'Other' && (!data.custom_country || data.custom_country.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please specify the country.",
      path: ['custom_country'],
    });
  }
  
  if (data.batch_name === NEW_BATCH_OPTION && (!data.new_batch_name || data.new_batch_name.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please enter a name for the new batch.",
      path: ['new_batch_name'],
    });
  }
});

type NewCandidateFormValues = z.infer<typeof NewCandidateSchema>;

interface NewCandidateFormProps {
  onSuccess: (candidate: Candidate) => void;
  onClose: () => void;
}

// Define AppConfig type locally for useQuery generics
interface AppConfig {
    countryOptions: string[];
}

const NewCandidateForm: React.FC<NewCandidateFormProps> = ({ onSuccess, onClose }) => {
  const { data: activeBatches = [], refetch: refetchBatches } = useQuery<string[]>({
    queryKey: ['activeBatches'],
    queryFn: api.getBatches,
  });
  
  // NEW: Fetch country options from API
  // Use explicit generics to handle the select function returning string[]
  const { data: countryOptions = [], isLoading: isLoadingConfig } = useQuery<AppConfig, Error, string[], string[]>({
    queryKey: ['appConfig'],
    queryFn: api.getAppConfig,
    select: (data) => data.countryOptions,
    initialData: [], // Initial data for the selected type (string[])
  });
  
  const form = useForm<NewCandidateFormValues>({
    resolver: zodResolver(NewCandidateSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      dob: '',
      passport_number: '',
      tracking_code: '',
      country_of_origin: '',
      custom_country: '',
      batch_name: NO_BATCH_OPTION, // Initialize with the constant
      new_batch_name: '',
    },
  });

  const { register, handleSubmit, formState: { errors, isSubmitting }, watch, setValue } = form;
  const selectedCountry = watch('country_of_origin');
  const selectedBatch = watch('batch_name');
  const isCustomCountry = selectedCountry === 'Other';
  const isCreatingNewBatch = selectedBatch === NEW_BATCH_OPTION;

  const onSubmit = async (data: NewCandidateFormValues) => {
    try {
      const finalCountry = data.country_of_origin === 'Other' ? data.custom_country : data.country_of_origin;
      
      if (!finalCountry) {
          toast.error("Country of Origin is required.");
          return;
      }
      
      let finalBatchName: string | undefined = undefined;
      if (data.batch_name === NEW_BATCH_OPTION) {
          finalBatchName = data.new_batch_name;
      } else if (data.batch_name && data.batch_name !== NO_BATCH_OPTION) {
          finalBatchName = data.batch_name;
      }

      const newCandidate = await api.createCandidate({
        first_name: data.first_name,
        last_name: data.last_name,
        dob: data.dob,
        passport_number: data.passport_number,
        tracking_code: data.tracking_code,
        country_of_origin: finalCountry,
        batch_name: finalBatchName,
      });
      
      toast.success(`Candidate ${newCandidate.tracking_code} created successfully.`);
      refetchBatches(); // Refresh batch list after creation
      onSuccess(newCandidate);
      onClose();
    } catch (error) {
      toast.error((error as Error).message);
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
          <Label htmlFor="tracking_code">Tracking Code *</Label>
          <Input id="tracking_code" {...register('tracking_code')} placeholder="TRK-XX-0000" />
          {errors.tracking_code && <p className="text-red-500 text-xs">{errors.tracking_code.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="country_of_origin">Country of Origin *</Label>
          <Select
            value={selectedCountry}
            onValueChange={(value) => {
              setValue('country_of_origin', value, { shouldValidate: true });
              if (value !== 'Other') {
                setValue('custom_country', '');
              }
            }}
          >
            <SelectTrigger id="country_of_origin">
              <SelectValue placeholder="Select Country" />
            </SelectTrigger>
            <SelectContent>
              {countryOptions.map(country => (
                <SelectItem key={country} value={country}>
                  {country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.country_of_origin && <p className="text-red-500 text-xs">{errors.country_of_origin.message}</p>}
        </div>
      </div>
      
      {isCustomCountry && (
        <div className="space-y-2">
          <Label htmlFor="custom_country">Specify Country *</Label>
          <Input id="custom_country" {...register('custom_country')} />
          {errors.custom_country && <p className="text-red-500 text-xs">{errors.custom_country.message}</p>}
        </div>
      )}

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
      
      {/* Batch Selection */}
      <div className="space-y-2">
        <Label htmlFor="batch_name">Batch Group (Optional)</Label>
        <Select
          value={selectedBatch}
          onValueChange={(value) => setValue('batch_name', value, { shouldValidate: true })}
        >
          <SelectTrigger id="batch_name">
            <SelectValue placeholder="Select or Create Batch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_BATCH_OPTION}>No Batch</SelectItem>
            {activeBatches.map(batch => (
              <SelectItem key={batch} value={batch}>
                {batch}
              </SelectItem>
            ))}
            <SelectItem value={NEW_BATCH_OPTION}>
              + Create New Batch
            </SelectItem>
          </SelectContent>
        </Select>
        {errors.batch_name && <p className="text-red-500 text-xs">{errors.batch_name.message}</p>}
      </div>
      
      {isCreatingNewBatch && (
        <div className="space-y-2 pl-4 border-l-2 border-primary">
          <Label htmlFor="new_batch_name">New Batch Name *</Label>
          <Input id="new_batch_name" {...register('new_batch_name')} placeholder="e.g., Batch 3" />
          {errors.new_batch_name && <p className="text-red-500 text-xs">{errors.new_batch_name.message}</p>}
        </div>
      )}

      <DialogFooter className="pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlusCircle className="h-4 w-4 mr-2" />}
          Create Candidate
        </Button>
      </DialogFooter>
    </form>
  );
};

export default NewCandidateForm;