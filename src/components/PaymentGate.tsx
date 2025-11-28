import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, DollarSign, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api'; // Import API

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
  const [isProcessing, setIsProcessing] = React.useState(false);
  // Use local state to show immediate success feedback, defaulting to the prop value
  const [localIsPaid, setLocalIsPaid] = React.useState(isPaid);

  // Sync local state if the prop changes (e.g., after a successful refetch)
  React.useEffect(() => {
    setLocalIsPaid(isPaid);
  }, [isPaid]);

  const handleMockPayment = async () => {
    setIsProcessing(true);
    toast.loading(`Initiating payment for ${stageTitle}...`, { id: 'payment-toast' });

    // Simulate Telebirr/Payment Gateway interaction
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock success 90% of the time
    const success = Math.random() > 0.1;

    if (success) {
      try {
        // 1. Persist the payment status change via API
        await api.updatePaymentStatus(candidateId, stageId, true);
        
        // 2. Update local state immediately for instant visual feedback
        setLocalIsPaid(true);
        
        toast.success(`Payment of ${feeAmount} ETB successful for ${stageTitle}!`, { id: 'payment-toast' });
        
        // 3. Trigger refetch in parent component (TrackingPage) to update global state
        onPaymentSuccess();
      } catch (error) {
        toast.error(`Payment successful but failed to record status: ${(error as Error).message}`, { id: 'payment-toast' });
      }
    } else {
      toast.error("Payment failed. Please try again or contact support.", { id: 'payment-toast' });
    }

    setIsProcessing(false);
  };

  if (localIsPaid) {
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
          onClick={handleMockPayment} 
          disabled={isProcessing}
          className="w-full bg-primary hover:bg-primary/90 text-white"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <DollarSign className="h-4 w-4 mr-2" />
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