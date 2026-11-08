import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarClock, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { buildWhatsAppUrl, getExpiringContracts, reminderMessage, whatsappDigits, type ExpiringContract, type ExpiryBand } from '@/lib/contract-expiry';
import type { ContractReminder } from '@/lib/types';
import { usePortalData } from '@/hooks/use-portal-data';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import CandidateQuickView from './CandidateQuickView';
import CandidateAvatar from './CandidateAvatar';
import WidgetShell from './WidgetShell';

type Recipient = ContractReminder['recipient'];

const BAND: Record<ExpiryBand, { label: string; tone: string }> = {
  urgent: { label: 'Under 1 month', tone: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
  soon: { label: '1 to 3 months', tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  upcoming: { label: '3 to 6 months', tone: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
};

const ExpiringContracts: React.FC<{ localAgencyId?: string }> = ({ localAgencyId }) => {
  const { candidates, locals } = usePortalData();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [band, setBand] = useState<ExpiryBand | 'all'>('all');
  const [target, setTarget] = useState<ExpiringContract | null>(null);
  const [recipient, setRecipient] = useState<Recipient>('candidate');
  const [message, setMessage] = useState('');
  const [quickId, setQuickId] = useState<string | null>(null);

  const all = useMemo(() => getExpiringContracts(candidates.filter(candidate => !localAgencyId || candidate.local_agency_id === localAgencyId)), [candidates, localAgencyId]);
  const rows = all.filter(item => band === 'all' || item.band === band);
  const count = (key: ExpiryBand) => all.filter(item => item.band === key).length;
  const agencyName = (item: ExpiringContract) => locals.find(agency => agency.id === item.candidate.local_agency_id)?.name;

  const phoneFor = (item: ExpiringContract, who: Recipient) =>
    who === 'candidate' ? item.candidate.phone_number : who === 'employer' ? item.candidate.employer?.phone : item.candidate.emergency_contact?.phone;

  const open = (item: ExpiringContract) => {
    setTarget(item);
    setRecipient('candidate');
    setMessage(reminderMessage(item, agencyName(item)));
  };

  const send = async () => {
    if (!target) return;
    const phone = phoneFor(target, recipient);
    const url = phone ? buildWhatsAppUrl(phone, message) : null;
    if (!url) return toast.error('This contact has no valid phone number for WhatsApp.');
    window.open(url, '_blank', 'noopener,noreferrer');
    const reminder: ContractReminder = { sent_at: new Date().toISOString(), channel: 'whatsapp', recipient, sent_by: user?.email, months_left: target.monthsLeft };
    try {
      await api.updateCandidateDetails(target.candidate.id, { contract_reminders: [...(target.candidate.contract_reminders ?? []), reminder] }, user?.id ?? 'unknown', user?.email ?? 'unknown');
      window.dispatchEvent(new CustomEvent('supabase-data-changed'));
      await queryClient.invalidateQueries();
      toast.success('WhatsApp opened and the reminder was recorded.');
      setTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The reminder could not be recorded.');
    }
  };

  return (
    <WidgetShell
      title="Contracts ending soon" description="Working candidates whose contract ends within six months" icon={CalendarClock} accent="amber" className="h-full"
      actions={<Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-300">{all.length} contract{all.length === 1 ? '' : 's'}</Badge>}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <Button size="sm" variant={band === 'all' ? 'default' : 'outline'} className="h-7 rounded-full px-3 text-xs" onClick={() => setBand('all')}>All {all.length}</Button>
        {(Object.keys(BAND) as ExpiryBand[]).map(key => <Button key={key} size="sm" variant={band === key ? 'default' : 'outline'} className="h-7 rounded-full px-3 text-xs" onClick={() => setBand(key)}>{BAND[key].label} {count(key)}</Button>)}
      </div>
      <div className="max-h-[420px] overflow-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="sticky top-0"><tr><th className="px-3 py-2 text-left">Candidate</th><th className="px-3 py-2 text-left">Employer</th><th className="px-3 py-2 text-left">Ends</th><th className="px-3 py-2 text-right">Reminder</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No contracts are ending in this window.</td></tr>}
            {rows.map(item => (
              <tr key={item.candidate.id}>
                <td className="px-3 py-2"><div className="flex items-center gap-2"><CandidateAvatar candidate={item.candidate} className="h-9 w-9" /><div><button type="button" className="font-medium hover:text-primary hover:underline" onClick={() => setQuickId(item.candidate.id)}>{item.candidate.first_name} {item.candidate.last_name}</button><p className="text-xs text-muted-foreground">{item.candidate.occupation} · {item.candidate.external_status?.destination_country}</p></div></div></td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{item.candidate.employer?.company ?? '\u2014'}</td>
                <td className="px-3 py-2"><Badge variant="secondary" className={cn('whitespace-nowrap', BAND[item.band].tone)}>{item.monthsLeft} mo</Badge><p className="mt-0.5 text-xs text-muted-foreground">{new Date(item.endsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</p></td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="outline" className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300" onClick={() => open(item)}><MessageCircle className="mr-1.5 h-3.5 w-3.5" />WhatsApp</Button>
                  {item.lastReminderAt && <p className="mt-0.5 text-[11px] text-muted-foreground">Sent {new Date(item.lastReminderAt).toLocaleDateString()}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!target} onOpenChange={value => !value && setTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-emerald-600" />Send contract reminder</DialogTitle>
            <DialogDescription>{target ? `${target.candidate.first_name} ${target.candidate.last_name} · contract ends in about ${target.monthsLeft} months` : ''}</DialogDescription>
          </DialogHeader>
          {target && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="wa-recipient">Send to</Label>
                <Select value={recipient} onValueChange={value => setRecipient(value as Recipient)}>
                  <SelectTrigger id="wa-recipient"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {([['candidate', 'Candidate'], ['employer', 'Employer contact'], ['emergency-contact', 'Emergency contact']] as Array<[Recipient, string]>).map(([value, label]) => (
                      <SelectItem key={value} value={value} disabled={!whatsappDigits(phoneFor(target, value))}>{label} · {phoneFor(target, value) ?? 'no number'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label htmlFor="wa-message">Message</Label><Textarea id="wa-message" rows={5} value={message} onChange={event => setMessage(event.target.value)} /></div>
              <p className="text-xs text-muted-foreground">This opens WhatsApp with the message ready to send from your own account, then records the reminder on the candidate.</p>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={send}>Open WhatsApp</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <CandidateQuickView candidateId={quickId} onOpenChange={open => !open && setQuickId(null)} />
    </WidgetShell>
  );
};

export default ExpiringContracts;
