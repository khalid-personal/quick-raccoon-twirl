import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Shuffle, GraduationCap, PlaneTakeoff } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { NewCandidateFormValues, NEW_BATCH_OPTION, NO_BATCH_OPTION, NONE_SELECT_VALUE } from './schema';

interface AgencyBatchDetailsSectionProps {
  form: UseFormReturn<NewCandidateFormValues>;
  cocAgencies: string[];
  foreignAgencies: string[];
  activeBatches: string[];
  isSubmitting: boolean;
  isCreatingNewBatch: boolean;
}

const AgencyBatchDetailsSection: React.FC<AgencyBatchDetailsSectionProps> = ({
  form,
  cocAgencies,
  foreignAgencies,
  activeBatches,
  isSubmitting,
  isCreatingNewBatch,
}) => {
  const { register, formState: { errors }, watch, setValue } = form;
  const selectedBatch = watch('batch_name');

  const handleSelectLeastUsed = async () => {
      try {
          const agency = await api.selectLeastUsedCocAgency();
          setValue('coc_agency', agency, { shouldValidate: true });
          toast.info(`Automatically selected: ${agency}`);
      } catch (error) {
          toast.error((error as Error).message);
      }
  };

  return (
    <>
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
                    <SelectItem value={NONE_SELECT_VALUE}>None</SelectItem>
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
                <SelectItem value={NONE_SELECT_VALUE}>N/A (Not Matched Yet)</SelectItem>
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
    </>
  );
};

export default AgencyBatchDetailsSection;