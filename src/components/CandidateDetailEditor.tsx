import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Save, Lock, Mail, Shuffle, GraduationCap, PlaneTakeoff, Landmark } from 'lucide-react'; // Added Landmark
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogFooter } from '@/components/ui/dialog';
import { CandidateDetail, Candidate, CocFacility, ForeignAgency, LocalAgency } from '@/lib/types'; // NEW IMPORT
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/auth'; // NEW IMPORT

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
  coc_facility_id: z.string().min(1, "COC Facility is required."), // Changed to ID
  foreign_agency_id: z.string().optional(), // Changed to ID
  local_agency_id: z.string().min(1, "Local Agency is required."), // NEW FIELD
  new_pin: z.string().optional().refine(
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
    cocFacilities: CocFacility[]; // Changed
    foreignAgencies: ForeignAgency[]; // Changed
    localAgencies: LocalAgency[]; // NEW
}

const CandidateDetailEditor: React.FC<CandidateDetailEditorProps> = ({ candidate, onSuccess, onClose }) => {
  const { user } = useAuth(); // Get current user for logging
  const actorId = user?.id || 'unknown-admin';
  const actorEmail = user?.email || 'unknown-admin@agency.com';

  const { data: activeBatches = [], refetch: refetchBatches } = useQuery<string[]>({
    queryKey: ['activeBatches'],
    queryFn: api.getBatches,
  });
  
  // Fetch country and COC agency options from API
  const { data: config, isLoading: isLoadingConfig } = useQuery<AppConfig>({
    queryKey: ['appConfig'],
    queryFn: api.getAppConfig,
    initialData: { countryOptions: [], cocFacilities: [], foreignAgencies: [], localAgencies: [] }, // Updated initialData
  });
  
  const countryOptions = config.countryOptions;
  const cocFacilities = config.cocFacilities; // Changed
  const foreignAgencies = config.foreignAgencies; // Changed
  const localAgencies = config.localAgencies; // NEW
  
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
      coc_facility_id: candidate.coc_facility_id || NONE_SELECT_VALUE, // Initialize COC facility ID
      foreign_agency_id: candidate.foreign_agency_id || NONE_SELECT_VALUE, // Initialize foreign agency ID
      local_agency_id: candidate.local_agency_id || NONE_SELECT_VALUE, // NEW: Initialize local agency ID
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
  
  const handleSelectLeastUsedCocFacility = async () => { // Renamed function
      try {
          const facility = await api.selectLeastUsedCocFacility(); // Renamed API call
          setValue('coc_facility_id', facility.id, { shouldValidate: true }); // Set ID
          toast.info(`Automatically selected: ${facility.name}`);
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
        coc_facility_id: data.coc_facility_id === NONE_SELECT_VALUE ? undefined : data.coc_facility_id, // Use ID
        foreign_agency_id: data.foreign_agency_id === NONE_SELECT_VALUE ? undefined : data.foreign_agency_id, // Use ID
        local_agency_id: data.local_agency_id === NONE_SELECT_VALUE ? undefined : data.local_agency_id, // Use ID
      }, actorId, actorEmail); // Pass actor info
      
      // 2. Update Credentials (Email/PIN) if changed
      if (data.email !== candidate.email || newPin) {
          await api.updateCandidateCredentials(candidate.id, data.email, newPin, actorId, actorEmail); // Pass actor info
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
      
      {/* Local Agency Selection */}
      <div className="space-y-2 border-t pt-4">
        <Label htmlFor="local_agency_id" className="flex items-center">
            <Landmark className="h-4 w-4 mr-2" /> Managing Local Agency *
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
                <SelectItem value={NONE_SELECT_VALUE}>None</SelectItem>
                {localAgencies.map(agency => (
                    <SelectItem key={agency.id} value={agency.id}>
                        {agency.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
        {errors.local_agency_id && <p className="text-red-500 text-xs">{errors.local_agency_id.message}</p>}
      </div>

      {/* COC Facility Selection */}
      <div className="space-y-2">
        <Label htmlFor="coc_facility_id" className="flex items-center">
            <GraduationCap className="h-4 w-4 mr-2" /> COC Training Facility *
        </Label>
        <div className="flex gap-2">
            <Select
                value={watch('coc_facility_id')}
                onValueChange={(value) => setValue('coc_facility_id', value, { shouldValidate: true })}
                disabled={isSubmitting || cocFacilities.length === 0}
            >
                <SelectTrigger id="coc_facility_id">
                    <SelectValue placeholder="Select COC Facility" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={NONE_SELECT_VALUE}>None</SelectItem>
                    {cocFacilities.map(facility => (
                        <SelectItem key={facility.id} value={facility.id}>
                            {facility.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button 
                type="button" 
                variant="outline" 
                size="icon" 
                onClick={handleSelectLeastUsedCocFacility} // Renamed
                disabled={isSubmitting || cocFacilities.length === 0}
                title="Select Least Used COC Facility (Mock Load Balancer)"
            >
                <Shuffle className="h-4 w-4" />
            </Button>
        </div>
        {errors.coc_facility_id && <p className="text-red-500 text-xs">{errors.coc_facility_id.message}</p>}
      </div>
      
      {/* Foreign Agency Selection */}
      <div className="space-y-2">
        <Label htmlFor="foreign_agency_id" className="flex items-center">
            <PlaneTakeoff className="h-4 w-4 mr-2" /> Foreign Employment Agency (Optional)
        </Label>
        <Select
            value={watch('foreign_agency_id')}
            onValueChange={(value) => setValue('foreign_agency_id', value, { shouldValidate: true })}
            disabled={isSubmitting || foreignAgencies.length === 0}
        >
            <SelectTrigger id="foreign_agency_id">
                <SelectValue placeholder="Select Foreign Agency" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NONE_SELECT_VALUE}>N/A (Not Matched Yet)</SelectItem>
                {foreignAgencies.map(agency => (
                    <SelectItem key={agency.id} value={agency.id}>
                        {agency.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
        {errors.foreign_agency_id && <p className="text-red-500 text-xs">{errors.foreign_agency_id.message}</p>}
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