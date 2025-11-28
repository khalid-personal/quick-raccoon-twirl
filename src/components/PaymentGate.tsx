import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, CreditCard, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface PaymentGateProps {
  stageTitle: string;
  feeAmount: number;
  isPaid: boolean;
  trackingCode: string;
  onPaymentSuccess: () => void; // Still needed to trigger parent refetch
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

  const paymentMutation = useMutation({
    mutationFn: async () => {
      // 1. Simulate Telebirr/Payment Gateway interaction
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock success 90% of the time
      const success = Math.random() > 0.1;

      if (!success) {
        throw new Error("Payment failed. Please try again or contact support.");
      }
      
      // 2. Persist the payment status change via API
      await api.updatePaymentStatus(candidateId, stageId, true);
    },
    onMutate: () => {
      // Use a unique ID for the loading toast
      toast.loading(`Initiating payment for ${stageTitle}...`, { id: 'payment-toast' });
    },
    onSuccess: () => {
      // Replace loading toast with success toast, ensuring it stays visible for 5 seconds
      toast.success(`Payment of ${feeAmount.toLocaleString()} ETB successful for ${stageTitle}!`, { id: 'payment-toast', duration: 5000 });
      
      // Optimistically update the current query data to show the change immediately
      // This prevents the flicker while the full refetch runs.
      queryClient.setQueryData(['publicTracking', trackingCode], (oldData: any) => {
        if (!oldData) return oldData;
        
        const newTimeline = oldData.timeline.map((item: any) => 
          item.stage_id === stageId ? { ...item, is_fee_paid: true } : item
        );
        return { ...oldData, timeline: newTimeline };
      });
      
      // Trigger the full refetch in the parent component (TrackingPage)
      onPaymentSuccess();
    },
    onError: (error) => {
      // Replace loading toast with error toast, ensuring it stays visible for 5 seconds
      toast.error(`Payment failed: ${error.message}`, { id: 'payment-toast', duration: 5000 });
    },
  });

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
    <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/50">
      <CardContent className="p-3 space-y-2">
        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
          <XCircle className="h-4 w-4 inline mr-2" />
          Required Fee: {feeAmount.toLocaleString()} ETB
        </p>
        <Button 
          onClick={() => paymentMutation.mutate()} 
          disabled={paymentMutation.isPending}
          className="w-full bg-primary hover:bg-primary/90 text-white"
        >
          {paymentMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4 mr-2" />
          )}
          Pay Now (Mock Telebirr)
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          This is a mock payment interface. Future integration with Telebirr will be here.
        </p>
      </CardContent>
    </Card>
  );
};

export default PaymentGate;