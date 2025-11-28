import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, PlusCircle, Shuffle, GraduationCap, PlaneTakeoff, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogFooter, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Candidate, CandidateDetail, ALL_STAGES } from '@/lib/types'; // Import CandidateDetail and ALL_STAGES
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { Separator } from '@/components/ui/separator';
import { v4 as uuidv4 } from 'uuid'; // Import uuid for mock ID
import { generateInitialStages } from '@/lib/data-seed'; // Import for mock stages
import CandidateProfilePreview from './CandidateProfilePreview'; // NEW IMPORT

const NEW_BATCH_OPTION = '___NEW_BATCH___';
const NO_BATCH_OPTION = '___NO_BATCH___'; // Non-empty string constant for 'No Batch'
const MARITAL_STATUS_OPTIONS = ['Single', 'Married', 'Divorced', 'Widowed'];
const NONE_SELECT_VALUE = "none"; // Consistent value for 'None' in selects

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
  marital_status: z.enum(MARITAL_STATUS_OPTIONS as [string, ...string[]], {
    required_error: "Marital status is required.",
  }),
  phone_number: z.string().optional(),
  email: z.string().email("Must be a valid email address.").min(1, "Email is required for candidate login."),
  coc_agency: z.string().min(1, "COC Agency is required."),
  foreign_agency: z.string().optional(), // NEW FIELD: Optional on creation
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

type NewCandidateFormValues = z.infer<typeof NewCandidateSchema>;

interface NewCandidateFormProps {
  onSuccess: (candidate: Candidate) => void;
  onClose: () => void;
}

// Define AppConfig type locally for useQuery generics
interface AppConfig {
    countryOptions: string[];
    cocAgencies: string[];
    foreignAgencies: string[]; // Added foreignAgencies
}

const NewCandidateForm: React.FC<NewCandidateFormProps> = ({ onSuccess, onClose }) => {
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
      batch_name: NO_BATCH_OPTION,
      marital_status: 'Single',
      phone_number: '',
      email: '',
      coc_agency: '',
      foreign_agency: '', // Initialize new field
      new_batch_name: '',
    },
  });

  const { register, handleSubmit, formState: { errors, isSubmitting }, watch, setValue } = form;
  const selectedCountry = watch('country_of_origin');
  const selectedBatch = watch('batch_name');
  const isCustomCountry = selectedCountry === 'Other';
  const isCreatingNewBatch = selectedBatch === NEW_BATCH_OPTION;
  
  const [previewCandidate, setPreviewCandidate] = React.useState<CandidateDetail | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = React.useState(false);

  const handleSelectLeastUsed = async () => {
      try {
          const agency = await api.selectLeastUsedCocAgency();
          setValue('coc_agency', agency, { shouldValidate: true });
          toast.info(`Automatically selected: ${agency}`);
      } catch (error) {
          toast.error((error as Error).message);
      }
  };
  
  const handlePreview = async () => {
    const isValid = await form.trigger(); // Validate all fields
    if (isValid) {
      const data = form.getValues();
      const finalCountry = data.country_of_origin === 'Other' ? data.custom_country : data.country_of_origin;
      let finalBatchName: string | undefined = undefined;
      if (data.batch_name === NEW_BATCH_OPTION) {
          finalBatchName = data.new_batch_name;
      } else if (data.batch_name && data.batch_name !== NO_BATCH_OPTION) {
          finalBatchName = data.batch_name;
      }

      const mockCandidate: Candidate = {
        id: uuidv4(), // Mock ID
        first_name: data.first_name,
        last_name: data.last_name,
        dob: data.dob,
        passport_number: data.passport_number,
        tracking_code: data.tracking_code,
        country_of_origin: finalCountry || '',
        batch_name: finalBatchName,
        marital_status: data.marital_status as Candidate['marital_status'],
        phone_number: data.phone_number || undefined,
        email: data.email,
        coc_agency: data.coc_agency,
        foreign_agency: data.foreign_agency === NONE_SELECT_VALUE ? undefined : data.foreign_agency, // Handle 'none'
        profile_image_url: undefined, // No image on creation
        created_at: new Date().toISOString(), // Mock creation date
        updated_at: new Date().toISOString(), // Mock update date
      };

      // Generate initial stages for the preview
      const initialStages = generateInitialStages(mockCandidate);

      const mockCandidateDetail: CandidateDetail = {
        ...mockCandidate,
        stages: initialStages,
        documents: [],
        medical_results: [],
        chat_messages: [],
      };

      setPreviewCandidate(mockCandidateDetail);
      setIsPreviewDialogOpen(true);
    } else {
      toast.error("Please correct the errors in the form before previewing.");
    }
  };

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
        marital_status: data.marital_status as Candidate['marital_status'],
        phone_number: data.phone_number || undefined,
        email: data.email,
        coc_agency: data.coc_agency === NONE_SELECT_VALUE ? undefined : data.coc_agency, // Handle 'none'
        foreign_agency: data.foreign_agency === NONE_SELECT_VALUE ? undefined : data.foreign_agency, // Handle 'none'
      });
      
      toast.success(`Candidate ${newCandidate.tracking_code} created successfully. Credentials: Email=${newCandidate.email}, PIN=123456 (Mock)`);
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
    <>
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
              <PlaneTakeoff className="h-4 w-4 mr-2" /> Foreign Employment Agency (Optional)
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

        <DialogFooter className="pt-4 flex justify-between">
          <Button 
            type="button" 
            variant="outline" 
            onClick={handlePreview} 
            disabled={isSubmitting}
          >
            <Eye className="h-4 w-4 mr-2" /> Preview Profile
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlusCircle className="h-4 w-4 mr-2" />}
            Create Candidate
          </Button>
        </DialogFooter>
      </form>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Candidate Profile Preview</DialogTitle>
          </DialogHeader>
          {previewCandidate && <CandidateProfilePreview candidate={previewCandidate} />}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NewCandidateForm;