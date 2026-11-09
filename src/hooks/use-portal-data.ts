import { useEffect, useState } from 'react';
import { getCandidateStages, getCandidates, getConfig, getForeignAgencies, getLocalAgencies, getPayments, getPaymentStatuses } from '@/lib/data-store';

const read = () => ({
  candidates: getCandidates(), payments: getPayments(), stages: getCandidateStages(),
  locals: getLocalAgencies(), foreigns: getForeignAgencies(),
  paymentStatuses: getPaymentStatuses(), stageFees: getConfig().stageFees ?? {},
});

// Dashboard widgets read the shared store and refresh whenever data is reloaded or edited elsewhere.
export const usePortalData = () => {
  const [data, setData] = useState(read);
  useEffect(() => {
    const refresh = () => setData(read());
    window.addEventListener('supabase-data-changed', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('agency-resolution-changed', refresh);
    window.addEventListener('bank-statement-changed', refresh);
    return () => { window.removeEventListener('supabase-data-changed', refresh); window.removeEventListener('storage', refresh); window.removeEventListener('agency-resolution-changed', refresh); window.removeEventListener('bank-statement-changed', refresh); };
  }, []);
  return data;
};
