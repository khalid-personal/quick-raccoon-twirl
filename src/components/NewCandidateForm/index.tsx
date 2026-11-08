import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, PlusCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogFooter, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Candidate, CandidateDetail, CocFacility, ForeignAgency, LocalAgency, UploadScanReport } from '@/lib/types'; // NEW IMPORT
import { useQuery } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { generateInitialStages } from '@/lib/data-seed';
import CandidateProfilePreview from '@/components/CandidateProfilePreview';
import PersonalDetailsSection from './PersonalDetailsSection';
import TrackingDetailsSection from './TrackingDetailsSection';
import AgencyBatchDetailsSection from './AgencyBatchDetailsSection';
import LoginCredentialsSection from './LoginCredentialsSection';
import CandidateIntroductionSection from './CandidateIntroductionSection';
import { NewCandidateSchema, NewCandidateFormValues, NEW_BATCH_OPTION, NO_BATCH_OPTION, isAdult, NONE_SELECT_VALUE } from './schema'; // Added NONE_SELECT_VALUE
import { useAuth } from '@/lib/auth';

interface NewCandidateFormProps {
  onSuccess: (candidate: Candidate) => void;
  onClose: () => void;
  prefill?: PassportPrefill | null;
}

export type PassportPrefill = Partial<Pick<NewCandidateFormValues, 'first_name' | 'last_name' | 'dob' | 'passport_number' | 'gender' | 'country_of_origin'>> &
  Pick<Candidate, 'passport_nationality' | 'passport_issuing_country' | 'passport_expiry_date' | 'passport_document_type'> &
  { passport_image_url?: string; passport_image_scan_report?: UploadScanReport };

// Define AppConfig type locally for useQuery generics
interface AppConfig {
    countryOptions: string[];
    cocFacilities: CocFacility[]; // Changed
    foreignAgencies: ForeignAgency[]; // Changed
    localAgencies: LocalAgency[]; // NEW
}

const NewCandidateForm: React.FC<NewCandidateFormProps> = ({ onSuccess, onClose, prefill }) => {
  const { user } = useAuth(); // Get current user for logging
  const actorId = user?.id || 'unknown-admin';
  const actorEmail = user?.email || 'unknown-admin@agency.com';

  const { data: activeBatches = [], refetch: refetchBatches } = useQuery<string[]>({
    queryKey: ['activeBatches'],
    queryFn: api.getBatches,
  });
  
  const { data: config, isLoading: isLoadingConfig } = useQuery<AppConfig>({
    queryKey: ['appConfig'],
    queryFn: api.getAppConfig,
    initialData: { countryOptions: [], cocFacilities: [], foreignAgencies: [], localAgencies: [] }, // Updated initialData
  });
  
  const countryOptions = [...new Set([...config.countryOptions, ...(prefill?.country_of_origin ? [prefill.country_of_origin] : []), 'Other'])];
  const passportMetadata = {
    passport_nationality: prefill?.passport_nationality,
    passport_issuing_country: prefill?.passport_issuing_country,
    passport_expiry_date: prefill?.passport_expiry_date,
    passport_document_type: prefill?.passport_document_type,
  };
  const cocFacilities = config.cocFacilities; // Changed
  const foreignAgencies = config.foreignAgencies; // Changed
  const localAgencies = config.localAgencies; // NEW
  
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
      gender: undefined,
      professional_summary: '',
      occupation: '',
      skills_text: '',
      languages_text: '',
      intro_video_url: '',
      phone_number: '',
      email: '',
      coc_facility_id: NONE_SELECT_VALUE, // Initialize with NONE_SELECT_VALUE
      foreign_agency_id: NONE_SELECT_VALUE, // Initialize with NONE_SELECT_VALUE
      local_agency_id: NONE_SELECT_VALUE, // Initialize with NONE_SELECT_VALUE
      new_batch_name: '',
    },
  });

  const { handleSubmit, formState: { errors, isSubmitting }, watch, setValue } = form;
  const selectedCountry = watch('country_of_origin');
  const selectedBatch = watch('batch_name');
  const isCustomCountry = selectedCountry === 'Other';
  const isCreatingNewBatch = selectedBatch === NEW_BATCH_OPTION;
  
  const [profileImageFile, setProfileImageFile] = React.useState<File | null>(null);
  const [profileImageScanReport, setProfileImageScanReport] = React.useState<UploadScanReport | null>(null);
  const [previewCandidate, setPreviewCandidate] = React.useState<CandidateDetail | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = React.useState(false);

  React.useEffect(() => {
    if (!prefill) return;
    for (const field of ['first_name', 'last_name', 'dob', 'passport_number', 'gender', 'country_of_origin'] as const) {
      const value = prefill[field];
      if (value) form.setValue(field, value);
    }
  }, [prefill, form]);

  const handlePreview = async () => {
    const isValid = await form.trigger();
    if (isValid) {
      const data = form.getValues();
      const finalCountry = data.country_of_origin === 'Other' ? data.custom_country : data.country_of_origin;
      let finalBatchName: string | undefined = undefined;
      if (data.batch_name === NEW_BATCH_OPTION) {
          finalBatchName = data.new_batch_name;
      } else if (data.batch_name && data.batch_name !== NO_BATCH_OPTION) {
          finalBatchName = data.batch_name;
      }

      const mockProfileImageUrl = profileImageFile ? URL.createObjectURL(profileImageFile) : undefined;

      const mockCandidate: Candidate = {
        ...passportMetadata,
        id: uuidv4(),
        first_name: data.first_name,
        last_name: data.last_name,
        dob: data.dob,
        passport_number: data.passport_number,
        tracking_code: data.tracking_code,
        country_of_origin: finalCountry || '',
        batch_name: finalBatchName,
        marital_status: data.marital_status as Candidate['marital_status'],
        gender: data.gender,
        professional_summary: data.professional_summary.trim(),
        occupation: data.occupation || undefined,
        skills: data.skills_text.split(',').map(skill => skill.trim()).filter(Boolean),
        languages: data.languages_text.split(',').map(language => language.trim()).filter(Boolean),
        intro_video_url: data.intro_video_url.trim(),
        phone_number: data.phone_number || undefined,
        email: data.email,
        coc_facility_id: data.coc_facility_id === NONE_SELECT_VALUE ? undefined : data.coc_facility_id, // Use ID
        foreign_agency_id: data.foreign_agency_id === NONE_SELECT_VALUE ? undefined : data.foreign_agency_id, // Use ID
        local_agency_id: data.local_agency_id === NONE_SELECT_VALUE ? undefined : data.local_agency_id, // Use ID
        profile_image_url: mockProfileImageUrl,
        profile_image_scan_report: profileImageScanReport ?? undefined,
        passport_image_url: prefill?.passport_image_url,
        passport_image_scan_report: prefill?.passport_image_scan_report,
        payment_status: 'unpaid',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const initialStages = generateInitialStages(mockCandidate);

      const mockCandidateDetail: CandidateDetail = {
        ...mockCandidate,
        stages: initialStages,
        documents: [],
        medical_results: [],
        chat_messages: [],
        coc_facility_name: cocFacilities.find(f => f.id === mockCandidate.coc_facility_id)?.name,
        foreign_agency_name: foreignAgencies.find(a => a.id === mockCandidate.foreign_agency_id)?.name,
        local_agency_name: localAgencies.find(a => a.id === mockCandidate.local_agency_id)?.name,
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

      let profileImageUrl: string | undefined = undefined;
      if (profileImageFile) {
        profileImageUrl = URL.createObjectURL(profileImageFile);
      }

      const newCandidate = await api.createCandidate({
        ...passportMetadata,
        first_name: data.first_name,
        last_name: data.last_name,
        dob: data.dob,
        passport_number: data.passport_number,
        tracking_code: data.tracking_code,
        country_of_origin: finalCountry,
        batch_name: finalBatchName,
        marital_status: data.marital_status as Candidate['marital_status'],
        gender: data.gender,
        professional_summary: data.professional_summary.trim(),
        occupation: data.occupation || undefined,
        skills: data.skills_text.split(',').map(skill => skill.trim()).filter(Boolean),
        languages: data.languages_text.split(',').map(language => language.trim()).filter(Boolean),
        intro_video_url: data.intro_video_url.trim(),
        phone_number: data.phone_number || undefined,
        email: data.email,
        coc_facility_id: data.coc_facility_id === NONE_SELECT_VALUE ? undefined : data.coc_facility_id, // Use ID
        foreign_agency_id: data.foreign_agency_id === NONE_SELECT_VALUE ? undefined : data.foreign_agency_id, // Use ID
        local_agency_id: data.local_agency_id === NONE_SELECT_VALUE ? undefined : data.local_agency_id, // Use ID
        profile_image_url: profileImageUrl,
        profile_image_scan_report: profileImageScanReport ?? undefined,
        passport_image_url: prefill?.passport_image_url,
        passport_image_scan_report: prefill?.passport_image_scan_report,
      }, actorId, actorEmail); // Pass actor info
      
      toast.success(`Candidate ${newCandidate.tracking_code} created successfully. Credentials: Email=${newCandidate.email}, PIN=123456 (Mock)`);
      refetchBatches();
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
      <DialogContent className="sm:max-w-[600px] flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Create New Candidate Record</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 flex-grow overflow-y-auto pr-2">
          {/* Personal Details Section */}
          <PersonalDetailsSection
            form={form}
            profileImageFile={profileImageFile}
            setProfileImageFile={setProfileImageFile}
            setProfileImageScanReport={setProfileImageScanReport}
            isSubmitting={isSubmitting}
          />

          {/* Tracking Details Section */}
          <TrackingDetailsSection
            form={form}
            countryOptions={countryOptions}
            isCustomCountry={isCustomCountry}
          />
          {prefill && <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <h3 className="font-semibold">Scanned passport details</h3>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">Nationality</dt><dd>{prefill.passport_nationality || 'Not read'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Issuing country</dt><dd>{prefill.passport_issuing_country || 'Not read'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Passport expires</dt><dd>{prefill.passport_expiry_date || 'Not read'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Document type</dt><dd>{prefill.passport_document_type || 'Not read'}</dd></div>
            </dl>
          </div>}

          <CandidateIntroductionSection form={form} />

          {/* Agency & Batch Details Section */}
          <AgencyBatchDetailsSection
            form={form}
            cocFacilities={cocFacilities} // Changed
            foreignAgencies={foreignAgencies} // Changed
            localAgencies={localAgencies} // NEW
            activeBatches={activeBatches}
            isSubmitting={isSubmitting}
            isCreatingNewBatch={isCreatingNewBatch}
          />

          {/* Login Credentials Section */}
          <LoginCredentialsSection form={form} />

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
      </DialogContent>

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