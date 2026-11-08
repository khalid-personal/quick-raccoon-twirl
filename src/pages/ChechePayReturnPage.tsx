import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle, CircleAlert, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { recordVerifiedStagePayment } from '@/lib/api/payment-processing';
import type { Payment } from '@/lib/types';
import PaymentReceipt from '@/components/PaymentReceipt';
import ChechePayBrand from '@/components/ChechePayBrand';

interface VerifyResponse {
  tx_ref?: string;
  status?: string;
  amount?: string | number;
  currency?: string;
  is_final?: boolean;
  candidateId?: string;
  stageId?: number;
  paymentId?: string;
  payment?: Payment;
  error?: string;
}

type ReturnState =
  | { kind: 'verifying' }
  | { kind: 'success'; receiptNumber: string; providerReference: string; stageId: number }
  | { kind: 'pending'; status: string }
  | { kind: 'error'; message: string };

const ChechePayReturnPage: React.FC = () => {
  const { txRef: pathTxRef } = useParams<{ txRef?: string }>();
  const [searchParams] = useSearchParams();
  const { candidateTrackingCode } = useAuth();
  const queryClient = useQueryClient();
  const queryTxRef = searchParams.get('tx_ref') || searchParams.get('txRef');
  const [state, setState] = useState<ReturnState>({ kind: 'verifying' });
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const verify = async () => {
      const txRef = pathTxRef || queryTxRef || sessionStorage.getItem('chechepay:last-tx-ref');
      if (!txRef) {
        setState({ kind: 'error', message: 'The checkout return link is missing its transaction reference.' });
        return;
      }
      try {
        const response = await fetch('/api/chechepay/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tx_ref: txRef }),
        });
        const result = await response.json() as VerifyResponse;
        if (!response.ok) throw new Error(result.error || 'ChechePay could not verify this payment.');
        if (result.status !== 'SUCCEEDED' || result.is_final !== true) {
          if (active) setState({ kind: 'pending', status: result.status || 'PENDING' });
          return;
        }
        if (!result.candidateId || !Number.isInteger(result.stageId) || !result.paymentId || !result.tx_ref) {
          throw new Error('The verified payment did not include complete stage information.');
        }

        const payment = await recordVerifiedStagePayment({
          id: result.paymentId,
          candidateId: result.candidateId,
          stageId: result.stageId as number,
          amount: Number(result.amount),
          currency: result.currency || 'ETB',
          actorId: 'chechepay',
          actorEmail: 'verified@chechepay',
          provider: 'chechepay',
          providerReference: result.tx_ref,
          alreadyPersisted: true,
          receiptNumber: result.payment?.receipt_number,
          chechePayReceipt: result.payment?.chechepay_receipt,
          initiatedBy: result.payment?.initiated_by,
          initiatedAt: result.payment?.initiated_at,
          origin: result.payment?.origin,
        });
        if (active) setReceiptPayment(payment);
        const receiptNumber = payment.receipt_number || payment.id;
        sessionStorage.removeItem('chechepay:last-tx-ref');
        localStorage.removeItem('chechepay:last-tx-ref');
        await queryClient.invalidateQueries();
        if (active) setState({ kind: 'success', receiptNumber, providerReference: result.tx_ref, stageId: result.stageId as number });
      } catch (error) {
        if (active) setState({ kind: 'error', message: error instanceof Error ? error.message : 'Payment verification failed.' });
      }
    };
    void verify();
    return () => { active = false; };
  }, [pathTxRef, queryTxRef, queryClient]);

  return <div className="chechepay-theme flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
    <Card className="w-full max-w-lg">
      <CardHeader><CardTitle>{state.kind === 'verifying' ? 'Verifying your payment' : state.kind === 'success' ? 'Payment confirmed' : state.kind === 'pending' ? 'Payment not confirmed yet' : 'Payment verification failed'}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <ChechePayBrand label="Payment verification" />
        {state.kind === 'verifying' && <div className="flex items-center gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Checking with ChechePay. Please keep this page open.</div>}
        {state.kind === 'success' && <>
          <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><CheckCircle className="h-5 w-5" />Payment confirmed and applied to this stage.</p>
          <dl className="space-y-1 rounded border p-3 text-sm">
            <div><dt className="inline font-medium">Receipt:</dt> <dd className="inline font-mono">{state.receiptNumber}</dd></div>
            <div><dt className="inline font-medium">ChechePay reference:</dt> <dd className="inline break-all font-mono">{state.providerReference}</dd></div>
            <div><dt className="inline font-medium">Stage ID:</dt> <dd className="inline">{state.stageId}</dd></div>
          </dl>
          <Button onClick={() => setReceiptOpen(true)} disabled={!receiptPayment}>View receipt</Button>
          {candidateTrackingCode && <Button asChild><Link to={`/track/${candidateTrackingCode}`}>Return to tracking</Link></Button>}
        </>}
        {state.kind === 'pending' && <p className="text-muted-foreground">ChechePay reports {state.status}. This stage will remain unpaid until ChechePay confirms success. Refresh this page later to check again.</p>}
        {state.kind === 'error' && <p className="flex items-center gap-2 text-destructive"><CircleAlert className="h-5 w-5" />{state.message}</p>}
        {state.kind !== 'verifying' && state.kind !== 'success' && <Button asChild variant="outline"><Link to="/login?tab=candidate">Return to candidate login</Link></Button>}
      </CardContent>
    </Card>
    <PaymentReceipt payment={receiptPayment} open={receiptOpen} onOpenChange={setReceiptOpen} />
  </div>;
};

export default ChechePayReturnPage;
