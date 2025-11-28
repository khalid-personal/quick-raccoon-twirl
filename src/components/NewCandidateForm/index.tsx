import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, PlusCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogFooter, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Candidate, CandidateDetail } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { generateInitialStages } from '@/lib/data-seed';
import CandidateProfilePreview from '@/components/CandidateProfilePreview';
import PersonalDetailsSection from './PersonalDetailsSection';
import TrackingDetailsSection from './TrackingDetailsSection';
import AgencyBatchDetailsSection from './AgencyBatchDetailsSection';
import LoginCredentialsSection from './LoginCredentialsSection';
import { NewCandidateSchema, NewCandidateFormValues, NEW_BATCH_OPTION, NO_BATCH_OPTION, isAdult } from './schema';
import { useAuth } from '@/lib/auth';

interface NewCandidateFormProps {
  onSuccess: (candidate: Candidate) => void;
  onClose: () => void;
}

// Define AppConfig type locally for useQuery generics
interface AppConfig {
    countryOptions: string[];
    cocAgencies: string[];
    foreignAgencies: string[];
}

const NewCandidateForm: React.FC<NewCandidateFormProps> = ({ onSuccess, onClose }) => {
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
    initialData: { countryOptions: [], cocAgencies: [], foreignAgencies: [] },
  });
  
  const countryOptions = config.countryOptions;
  const cocAgencies = config.cocAgencies;
  const foreignAgencies = config.foreignAgencies;
  
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
      foreign_agency: '',
      new_batch_name: '',
    },
  });

  const { handleSubmit, formState: { errors, isSubmitting }, watch, setValue } = form;
  const selectedCountry = watch('country_of_origin');
  const selectedBatch = watch('batch_name');
  const isCustomCountry = selectedCountry === 'Other';
  const isCreatingNewBatch = selectedBatch === NEW_BATCH_OPTION;
  
  const [profileImageFile, setProfileImageFile] = React.useState<File | null>(null);
  const [previewCandidate, setPreviewCandidate] = React.useState<CandidateDetail | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = React.useState(false);

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
        id: uuidv4(),
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
        foreign_agency: data.foreign_agency,
        profile_image_url: mockProfileImageUrl,
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
        coc_agency: data.coc_agency,
        foreign_agency: data.foreign_agency,
        profile_image_url: profileImageUrl,
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
            isSubmitting={isSubmitting}
          />

          {/* Tracking Details Section */}
          <TrackingDetailsSection
            form={form}
            countryOptions={countryOptions}
            isCustomCountry={isCustomCountry}
          />

          {/* Agency & Batch Details Section */}
          <AgencyBatchDetailsSection
            form={form}
            cocAgencies={cocAgencies}
            foreignAgencies={foreignAgencies}
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