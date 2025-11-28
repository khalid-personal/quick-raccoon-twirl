import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Shuffle, GraduationCap, PlaneTakeoff, Landmark } from 'lucide-react'; // Added Landmark icon
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { NewCandidateFormValues, NEW_BATCH_OPTION, NO_BATCH_OPTION, NONE_SELECT_VALUE } from './schema';
import { CocFacility, ForeignAgency, LocalAgency } from '@/lib/types'; // NEW IMPORT

interface AgencyBatchDetailsSectionProps {
  form: UseFormReturn<NewCandidateFormValues>;
  cocFacilities: CocFacility[]; // Changed to CocFacility[]
  foreignAgencies: ForeignAgency[]; // Changed to ForeignAgency[]
  localAgencies: LocalAgency[]; // NEW: Added localAgencies
  activeBatches: string[];
  isSubmitting: boolean;
  isCreatingNewBatch: boolean;
}

const AgencyBatchDetailsSection: React.FC<AgencyBatchDetailsSectionProps> = ({
  form,
  cocFacilities,
  foreignAgencies,
  localAgencies, // NEW
  activeBatches,
  isSubmitting,
  isCreatingNewBatch,
}) => {
  const { register, formState: { errors }, watch, setValue } = form;
  const selectedBatch = watch('batch_name');

  const handleSelectLeastUsedCocFacility = async () => { // Renamed function
      try {
          const facility = await api.selectLeastUsedCocFacility(); // Renamed API call
          setValue('coc_facility_id', facility.id, { shouldValidate: true }); // Set ID
          toast.info(`Automatically selected: ${facility.name}`);
      } catch (error) {
          toast.error((error as Error).message);
      }
  };

  return (
    <>
      <h3 className="text-lg font-semibold border-b pb-2">Agency & Batch Details</h3>
      
      {/* Local Agency Selection */}
      <div className="space-y-2 pt-4">
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
    </>
  );
};

export default AgencyBatchDetailsSection;