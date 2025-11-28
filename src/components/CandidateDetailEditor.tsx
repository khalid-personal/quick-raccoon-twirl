import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Save, Lock, Mail, Shuffle, GraduationCap, PlaneTakeoff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogFooter } from '@/components/ui/dialog';
import { CandidateDetail, Candidate } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { Separator } from '@/components/ui/separator'; // Import Separator

const NEW_BATCH_OPTION = '___NEW_BATCH___';
const NO_BATCH_OPTION = '___NO_BATCH___';
const MARITAL_STATUS_OPTIONS = ['Single', 'Married', 'Divorced', 'Widowed'];
const NONE_SELECT_VALUE = "none"; // Consistent value for 'None' in selects

// Helper function to check if DOB is 18+
const isAdult = (dob: string): boolean => {
    const birthDate = new Date(dob);
    const ageDiffMs = Date.now() - birthDate.getTime();
    const ageDate = new Date(ageDiffMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970) >= 18;
};

// Schema for form validation (similar to NewCandidateForm, but adapted for updates)
const EditCandidateSchema = z.object({
  first_name: z.string().min(1, "First name is required."),
  last_name: z.string().min(1, "Last name is required."),
  dob: z.string().min(1, "Date of Birth is required."),
  passport_number: z.string().min(1, "Passport number is required."),
  tracking_code: z.string().min(1, "Tracking code is required.").regex(/^TRK-[A-Z]{2,3}-\d{4,}$/, "Invalid tracking code format (e.g., TRK-ET-0001)."),
  country_of_origin: z.string().min(1, "Country of origin is required."),
  marital_status: z.enum(MARITAL_STATUS_OPTIONS as [string, ...string[]], {
    required_error: "Marital status is required.",
  }),
  phone_number: z.string().optional(),
  email: z.string().email("Must be a valid email address.").min(1, "Email is required for candidate login."),
  coc_agency: z.string().min(1, "COC Agency is required."),
  foreign_agency: z.string().optional(), // NEW FIELD
  new_pin: z.string().optional().refine( // NEW PIN FIELD
    (val) => !val || val.length >= 6,
    "PIN must be at least 6 characters long."
  ),
  custom_country: z.string().optional(),
  batch_name: z.string().optional(),
  new_batch_name: z.string().optional(),
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

type EditCandidateFormValues = z.infer<typeof EditCandidateSchema>;

interface CandidateDetailEditorProps {
  candidate: CandidateDetail;
  onSuccess: () => void;
  onClose: () => void;
}

// Define AppConfig type locally for useQuery generics
interface AppConfig {
    countryOptions: string[];
    cocAgencies: string[];
    foreignAgencies: string[]; // Added foreignAgencies
}

const CandidateDetailEditor: React.FC<CandidateDetailEditorProps> = ({ candidate, onSuccess, onClose }) => {
  const { data: activeBatches = [], refetch: refetchBatches } = useQuery<string[]>({
    queryKey: ['activeBatches'],
    queryFn: api.getBatches,
  });
  
  // Fetch country, COC agency, and Foreign agency options from API
  const { data: config, isLoading: isLoadingConfig } = useQuery<AppConfig>({
    queryKey: ['appConfig'],
    queryFn: api.getAppConfig,
    initialData: { countryOptions: [], cocAgencies: [], foreignAgencies: [] },
  });
  
  const countryOptions = config.countryOptions;
  const cocAgencies = config.cocAgencies;
  const foreignAgencies = config.foreignAgencies; // NEW
  
  // Determine if the candidate's country is a custom entry (not in the standard list)
  const isCustomCountryInitial = !countryOptions.includes(candidate.country_of_origin);
  
  const form = useForm<EditCandidateFormValues>({
    resolver: zodResolver(EditCandidateSchema),
    defaultValues: {
      first_name: candidate.first_name,
      last_name: candidate.last_name,
      dob: candidate.dob,
      passport_number: candidate.passport_number,
      tracking_code: candidate.tracking_code,
      
      // Set country fields based on whether it's a standard or custom country
      country_of_origin: isCustomCountryInitial ? 'Other' : candidate.country_of_origin,
      custom_country: isCustomCountryInitial ? candidate.country_of_origin : '',
      
      batch_name: candidate.batch_name || NO_BATCH_OPTION,
      marital_status: candidate.marital_status, // Initialize marital status
      phone_number: candidate.phone_number || '', // Initialize phone number
      email: candidate.email, // Initialize email
      coc_agency: candidate.coc_agency || NONE_SELECT_VALUE, // Initialize COC agency, use "none" for empty
      foreign_agency: candidate.foreign_agency || NONE_SELECT_VALUE, // Initialize NEW field, use "none" for empty
      new_pin: '', // Initialize new PIN field
      new_batch_name: '',
    },
  });

  const { register, handleSubmit, formState: { errors, isSubmitting }, watch, setValue } = form;
  const selectedCountry = watch('country_of_origin');
  const selectedBatch = watch('batch_name');
  const isCustomCountry = selectedCountry === 'Other';
  const isCreatingNewBatch = selectedBatch === NEW_BATCH_OPTION;
  const newPin = watch('new_pin');
  
  const handleSelectLeastUsed = async () => {
      try {
          const agency = await api.selectLeastUsedCocAgency();
          setValue('coc_agency', agency, { shouldValidate: true });
          toast.info(`Automatically selected: ${agency}`);
      } catch (error) {
          toast.error((error as Error).message);
      }
  };

  const onSubmit = async (data: EditCandidateFormValues) => {
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
      
      // 1. Update Profile Details
      await api.updateCandidateDetails(candidate.id, {
        first_name: data.first_name,
        last_name: data.last_name,
        dob: data.dob,
        passport_number: data.passport_number,
        tracking_code: data.tracking_code,
        country_of_origin: finalCountry,
        batch_name: finalBatchName,
        marital_status: data.marital_status as Candidate['marital_status'],
        phone_number: data.phone_number || undefined,
        email: data.email,
        coc_agency: data.coc_agency === NONE_SELECT_VALUE ? undefined : data.coc_agency, // Handle 'none'
        foreign_agency: data.foreign_agency === NONE_SELECT_VALUE ? undefined : data.foreign_agency, // Handle 'none'
      });
      
      // 2. Update Credentials (Email/PIN) if changed
      if (data.email !== candidate.email || newPin) {
          await api.updateCandidateCredentials(candidate.id, data.email, newPin);
          toast.success(`Candidate credentials updated.`);
      }
      
      toast.success(`Candidate ${data.tracking_code} details updated successfully.`);
      refetchBatches(); // Refresh batch list after potential batch change
      onSuccess();
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

  // Ensure the current candidate's country is available in the select options if it's not 'Other'
  const effectiveCountryOptions = countryOptions.includes(candidate.country_of_origin) || isCustomCountryInitial
    ? countryOptions
    : [...countryOptions.filter(c => c !== 'Other'), candidate.country_of_origin, 'Other'];


  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h3 className="text-lg font-semibold border-b pb-2 mb-4">Personal & Tracking Details</h3>
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
              {effectiveCountryOptions.map(country => (
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
      
      {/* Marital Status Selection */}
      <div className="space-y-2">
        <Label htmlFor="marital_status">Marital Status *</Label>
        <Select
          value={watch('marital_status')}
          onValueChange={(value) => setValue('marital_status', value, { shouldValidate: true })}
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
      
      <Separator className="my-6" />
      <h3 className="text-lg font-semibold border-b pb-2">Agency & Batch Details</h3>
      
      {/* COC Agency Selection */}
      <div className="space-y-2 pt-4">
        <Label htmlFor="coc_agency" className="flex items-center">
            <GraduationCap className="h-4 w-4 mr-2" /> COC Training Agency *
        </Label>
        <div className="flex gap-2">
            <Select
                value={watch('coc_agency')}
                onValueChange={(value) => setValue('coc_agency', value, { shouldValidate: true })}
                disabled={isSubmitting}
            >
                <SelectTrigger id="coc_agency">
                    <SelectValue placeholder="Select COC Agency" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={NONE_SELECT_VALUE}>None</SelectItem> {/* Changed value="" to "none" */}
                    {cocAgencies.map(agency => (
                        <SelectItem key={agency} value={agency}>
                            {agency}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button 
                type="button" 
                variant="outline" 
                size="icon" 
                onClick={handleSelectLeastUsed}
                disabled={isSubmitting || cocAgencies.length === 0}
                title="Select Least Used Agency (Mock Load Balancer)"
            >
                <Shuffle className="h-4 w-4" />
            </Button>
        </div>
        {errors.coc_agency && <p className="text-red-500 text-xs">{errors.coc_agency.message}</p>}
      </div>
      
      {/* Foreign Agency Selection */}
      <div className="space-y-2">
        <Label htmlFor="foreign_agency" className="flex items-center">
            <PlaneTakeoff className="h-4 w-4 mr-2" /> Foreign Employment Agency
        </Label>
        <Select
            value={watch('foreign_agency')}
            onValueChange={(value) => setValue('foreign_agency', value, { shouldValidate: true })}
            disabled={isSubmitting}
        >
            <SelectTrigger id="foreign_agency">
                <SelectValue placeholder="Select Foreign Agency" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NONE_SELECT_VALUE}>N/A (Not Matched Yet)</SelectItem> {/* Changed value="" to "none" */}
                {foreignAgencies.map(agency => (
                    <SelectItem key={agency} value={agency}>
                        {agency}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
        {errors.foreign_agency && <p className="text-red-500 text-xs">{errors.foreign_agency.message}</p>}
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
      
      <Separator className="my-6" />
      
      <h3 className="text-lg font-semibold border-b pb-2 mb-4">Candidate Login Credentials</h3>
      
      {/* Email Input for Candidate Login */}
      <div className="space-y-2">
        <Label htmlFor="email" className="flex items-center">
            <Mail className="h-4 w-4 mr-2" /> Candidate Email (Login) *
        </Label>
        <Input id="email" {...register('email')} placeholder="candidate@example.com" />
        {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
      </div>
      
      {/* Phone Number Input */}
      <div className="space-y-2">
        <Label htmlFor="phone_number">Phone Number (Optional)</Label>
        <Input id="phone_number" {...register('phone_number')} placeholder="+2519XXXXXXXX" />
        {errors.phone_number && <p className="text-red-500 text-xs">{errors.phone_number.message}</p>}
      </div>
      
      {/* PIN Reset Input */}
      <div className="space-y-2">
        <Label htmlFor="new_pin" className="flex items-center">
            <Lock className="h-4 w-4 mr-2" /> Reset PIN (Leave blank to keep current)
        </Label>
        <Input 
            id="new_pin" 
            type="password" 
            placeholder="••••••"
            {...register('new_pin')} 
        />
        {errors.new_pin && <p className="text-red-500 text-xs">{errors.new_pin.message}</p>}
        <p className="text-xs text-muted-foreground">
            If changed, the candidate must use this new PIN/Password for tracking login.
        </p>
      </div>

      <DialogFooter className="pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save All Changes
        </Button>
      </DialogFooter>
    </form>
  );
};

export default CandidateDetailEditor;