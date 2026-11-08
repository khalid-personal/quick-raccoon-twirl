import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { NewCandidateFormValues } from './schema';
import { Button } from '@/components/ui/button';
import { WandSparkles } from 'lucide-react';
import { nextTrackingCode } from '@/lib/tracking-code';
import { getCandidates } from '@/lib/data-store';
import { toast } from 'sonner';

interface TrackingDetailsSectionProps {
  form: UseFormReturn<NewCandidateFormValues>;
  countryOptions: string[];
  isCustomCountry: boolean;
}

const TrackingDetailsSection: React.FC<TrackingDetailsSectionProps> = ({
  form,
  countryOptions,
  isCustomCountry,
}) => {
  const { register, formState: { errors }, watch, setValue } = form;
  const selectedCountry = watch('country_of_origin');
  const isSubmitting = form.formState.isSubmitting;
  const generateCode = () => {
    try {
      setValue('tracking_code', nextTrackingCode(selectedCountry === 'Other' ? watch('custom_country') ?? '' : selectedCountry, getCandidates()), { shouldValidate: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not generate a tracking code.');
    }
  };

  return (
    <>
      <h3 className="text-lg font-semibold border-b pb-2">Tracking & Origin Details</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        <div className="space-y-2">
          <Label htmlFor="tracking_code">Tracking Code *</Label>
          <Input id="tracking_code" {...register('tracking_code')} placeholder="TRK-XX-0000" disabled={isSubmitting} />
          <Button type="button" variant="outline" size="sm" onClick={generateCode} disabled={isSubmitting}>
            <WandSparkles className="mr-2 h-4 w-4" />Generate next tracking code
          </Button>
          <p className="text-xs text-muted-foreground">Uses the origin country and the next number after the highest existing code. Availability is checked again when saving.</p>
          {errors.tracking_code && <p className="text-red-500 text-xs">{errors.tracking_code.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="passport_number">Passport Number *</Label>
          <Input id="passport_number" {...register('passport_number')} disabled={isSubmitting} />
          {errors.passport_number && <p className="text-red-500 text-xs">{errors.passport_number.message}</p>}
        </div>
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
          disabled={isSubmitting}
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
      
      {isCustomCountry && (
        <div className="space-y-2 pl-4 border-l-2 border-primary">
          <Label htmlFor="custom_country">Specify Country *</Label>
          <Input id="custom_country" {...register('custom_country')} disabled={isSubmitting} />
          {errors.custom_country && <p className="text-red-500 text-xs">{errors.custom_country.message}</p>}
        </div>
      )}
      
      <Separator className="my-6" />
    </>
  );
};

export default TrackingDetailsSection;