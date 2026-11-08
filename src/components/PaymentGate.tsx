import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, CreditCard, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import type { PublicTrackingData } from '@/lib/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { isDemoMode } from '@/lib/demo-mode';
import ChechePayBrand from './ChechePayBrand';
import chechePayLogo from '@/assets/cheche-pay-logo.svg';

interface PaymentGateProps {
  stageTitle: string;
  feeAmount: number;
  isPaid: boolean;
  trackingCode: string;
  onPaymentSuccess: () => void;
  candidateId: string;
  stageId: number;
}

const PaymentGate: React.FC<PaymentGateProps> = ({
  stageTitle,
  feeAmount,
  isPaid,
  trackingCode,
  onPaymentSuccess,
  candidateId,
  stageId,
}) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const applyPaidState = () => {
    queryClient.setQueryData<PublicTrackingData | null>(['publicTracking', trackingCode], oldData => {
      if (!oldData) return oldData;
      return { ...oldData, timeline: oldData.timeline.map(item => item.stage_id === stageId ? { ...item, is_fee_paid: true } : item) };
    });
    onPaymentSuccess();
  };

  const startCheckout = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      if (isDemoMode()) {
        await api.mockPayForStage(candidateId, stageId, feeAmount);
        applyPaidState();
        toast.success(`Demo payment recorded for ${stageTitle}.`);
        setIsProcessing(false);
        setDialogOpen(false);
        return;
      }
      const checkout = await api.initializeCandidateStageCheckout(candidateId, stageId, feeAmount);
      sessionStorage.setItem('chechepay:last-tx-ref', checkout.transactionReference);
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      setIsProcessing(false);
      toast.error(error instanceof Error ? error.message : 'Payment could not be started.');
    }
  };

  if (isPaid) {
    return (
      <Card className="border-green-500 bg-green-50 dark:bg-green-950/50">
        <CardContent className="p-3 flex items-center space-x-2 text-sm font-medium text-green-700 dark:text-green-300">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <span>Fee Paid: {feeAmount.toLocaleString()} ETB. You are cleared for the next step.</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="chechepay-theme border-yellow-500 bg-yellow-50 dark:bg-yellow-950/50">
      <CardContent className="p-3 space-y-2">
        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
          <XCircle className="h-4 w-4 inline mr-2" />
          Required Fee: {feeAmount.toLocaleString()} ETB
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="chechepay-logo-pay h-auto min-h-20 w-full gap-3 px-4 py-1" aria-label="Pay with ChechePay"><span className="shrink-0 text-base font-semibold">Pay with</span><img src={chechePayLogo} alt="" aria-hidden="true" className="h-20 w-40 max-w-[55%] shrink-0 object-contain" width={160} height={80} /></Button></DialogTrigger>
          <DialogContent className="chechepay-theme">
            <ChechePayBrand label={isDemoMode() ? 'Demo only · no charge' : 'Hosted checkout'} />
            <DialogHeader>
              <DialogTitle>Pay for {stageTitle}</DialogTitle>
              <DialogDescription>{isDemoMode() ? 'Demo payment only. No money will be collected.' : 'Continue to ChechePay’s secure hosted checkout. Payment is confirmed by the server before this stage is marked paid.'}</DialogDescription>
            </DialogHeader>
            <div className="rounded border p-3 text-sm"><span className="text-muted-foreground">Stage fee</span><p className="text-xl font-semibold">{feeAmount.toLocaleString()} ETB</p></div>
            {!isDemoMode() && <div className="flex items-center gap-2 rounded border p-3 text-sm text-muted-foreground"><ExternalLink className="h-4 w-4 shrink-0" />ChechePay may add its processing fee; the final total appears at checkout.</div>}
            <DialogFooter><Button type="button" className="chechepay-pay" onClick={() => void startCheckout()} disabled={isProcessing}>{isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}{isProcessing ? 'Connecting...' : isDemoMode() ? 'Confirm demo payment' : 'Continue to ChechePay'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default PaymentGate;