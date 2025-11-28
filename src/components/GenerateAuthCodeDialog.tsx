import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, KeyRound, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';

const GenerateAuthCodeSchema = z.object({
  coc_agency_name: z.string().optional(),
  foreign_agency_name: z.string().optional(),
  expires_in_days: z.string().optional().refine(
    (val) => !val || (Number(val) > 0 && Number(val) <= 365),
    "Days must be a positive number up to 365."
  ),
  max_uses: z.string().optional().refine(
    (val) => !val || (Number(val) > 0 && Number(val) <= 1000),
    "Max uses must be a positive number up to 1000."
  ),
});

type GenerateAuthCodeFormValues = z.infer<typeof GenerateAuthCodeSchema>;

interface GenerateAuthCodeDialogProps {
  onClose: () => void;
}

const GenerateAuthCodeDialog: React.FC<GenerateAuthCodeDialogProps> = ({ onClose }) => {
  const { user } = useAuth();
  const actorId = user?.id || 'unknown';
  const actorEmail = user?.email || 'unknown@agency.com';

  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['appConfig'],
    queryFn: api.getAppConfig,
    initialData: { countryOptions: [], cocAgencies: [], foreignAgencies: [] },
  });

  const cocAgencies = config.cocAgencies;
  const foreignAgencies = config.foreignAgencies;

  const form = useForm<GenerateAuthCodeFormValues>({
    resolver: zodResolver(GenerateAuthCodeSchema),
    defaultValues: {
      coc_agency_name: '',
      foreign_agency_name: '',
      expires_in_days: '',
      max_uses: '',
    },
  });

  const { register, handleSubmit, formState: { errors, isSubmitting }, watch, setValue } = form;
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const onSubmit = async (data: GenerateAuthCodeFormValues) => {
    setGeneratedCode(null);
    setCopied(false);
    try {
      const newAuthCode = await api.generateAuthorizationCode(
        data.coc_agency_name || undefined,
        data.foreign_agency_name || undefined,
        actorId,
        actorEmail,
        data.expires_in_days ? Number(data.expires_in_days) : undefined,
        data.max_uses ? Number(data.max_uses) : undefined
      );
      setGeneratedCode(newAuthCode.code);
      toast.success("Authorization code generated successfully!");
    } catch (error) {
      toast.error(`Failed to generate code: ${(error as Error).message}`);
    }
  };

  const handleCopy = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.info("Code copied to clipboard!");
    }
  };

  if (isLoadingConfig) {
    return (
      <DialogContent className="sm:max-w-[500px]">
        <div className="flex justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle className="flex items-center">
          <KeyRound className="h-6 w-6 mr-2 text-primary" /> Generate Staff Authorization Code
        </DialogTitle>
      </DialogHeader>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
        <p className="text-sm text-muted-foreground">
          Generate a unique code for new staff registrations. You can optionally link it to specific agencies.
        </p>

        {/* COC Agency */}
        <div className="space-y-2">
          <Label htmlFor="coc_agency_name">Link to COC Training Agency (Optional)</Label>
          <Select
            value={watch('coc_agency_name')}
            onValueChange={(value) => setValue('coc_agency_name', value, { shouldValidate: true })}
            disabled={isSubmitting}
          >
            <SelectTrigger id="coc_agency_name">
              <SelectValue placeholder="Select COC Agency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {cocAgencies.map(agency => (
                <SelectItem key={agency} value={agency}>
                  {agency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.coc_agency_name && <p className="text-red-500 text-xs mt-1">{errors.coc_agency_name.message}</p>}
        </div>

        {/* Foreign Agency */}
        <div className="space-y-2">
          <Label htmlFor="foreign_agency_name">Link to Foreign Employment Agency (Optional)</Label>
          <Select
            value={watch('foreign_agency_name')}
            onValueChange={(value) => setValue('foreign_agency_name', value, { shouldValidate: true })}
            disabled={isSubmitting}
          >
            <SelectTrigger id="foreign_agency_name">
              <SelectValue placeholder="Select Foreign Agency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {foreignAgencies.map(agency => (
                <SelectItem key={agency} value={agency}>
                  {agency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.foreign_agency_name && <p className="text-red-500 text-xs mt-1">{errors.foreign_agency_name.message}</p>}
        </div>

        <Separator />

        {/* Expiry and Max Uses */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="expires_in_days">Expires In (Days, Optional)</Label>
            <Input 
              id="expires_in_days" 
              type="number" 
              placeholder="e.g., 30" 
              {...register('expires_in_days')} 
              disabled={isSubmitting}
            />
            {errors.expires_in_days && <p className="text-red-500 text-xs mt-1">{errors.expires_in_days.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_uses">Max Uses (Optional)</Label>
            <Input 
              id="max_uses" 
              type="number" 
              placeholder="e.g., 1" 
              {...register('max_uses')} 
              disabled={isSubmitting}
            />
            {errors.max_uses && <p className="text-red-500 text-xs mt-1">{errors.max_uses.message}</p>}
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
            Generate Code
          </Button>
        </DialogFooter>
      </form>

      {generatedCode && (
        <div className="mt-6 p-4 border rounded-md bg-green-50 dark:bg-green-900/20 flex items-center justify-between">
          <div className="flex-grow">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">Generated Code:</p>
            <p className="font-mono text-lg font-bold text-green-900 dark:text-green-100 break-all">{generatedCode}</p>
          </div>
          <Button 
            onClick={handleCopy} 
            variant="ghost" 
            size="icon" 
            className="ml-4 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-800"
            title="Copy to clipboard"
          >
            {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
          </Button>
        </div>
      )}
    </DialogContent>
  );
};

export default GenerateAuthCodeDialog;