import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, Send } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { getAgencyThreads, getCandidates } from '@/lib/data-store';
import type { AgencyChatMessage, AgencyChatThread } from '@/lib/types';
import PageHeader from '@/components/page/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const AgencyConversationPage: React.FC = () => {
  const { user, userRole, userLocalAgencyId, userForeignAgencyId } = useAuth();
  const [searchParams] = useSearchParams();
  const candidateId = searchParams.get('candidateId');
  const client = useQueryClient();
  const localSide = userRole === 'local-agency';
  const { data: threads = [] } = useQuery<AgencyChatThread[]>({
    queryKey: ['agencyThreads', userRole, userLocalAgencyId, userForeignAgencyId],
    queryFn: () => localSide
      ? api.getAgencyThreadsForLocal(userLocalAgencyId ?? '')
      : userRole === 'agency' || userRole === 'foreign-agency' || userRole === 'foreign-agency-staff'
        ? api.getAgencyThreadsForForeign(userForeignAgencyId ?? '')
        : Promise.resolve(getAgencyThreads()),
    enabled: localSide ? !!userLocalAgencyId : userRole === 'agency' || userRole === 'foreign-agency' || userRole === 'foreign-agency-staff' || userRole === 'admin' || userRole === 'superadmin' || userRole === 'staff',
    refetchInterval: 10000,
  });
  const [selectedKey, setSelectedKey] = React.useState('');
  const [message, setMessage] = React.useState('');
  const selected = threads.find(thread => `${thread.local_agency_id}:${thread.foreign_agency_id}` === selectedKey) ?? threads[0];
  const selectedLocalId = selected?.local_agency_id;
  const selectedForeignId = selected?.foreign_agency_id;
  React.useEffect(() => {
    if (!candidateId) return;
    const candidate = getCandidates().find(item => item.id === candidateId);
    if (candidate?.local_agency_id && candidate.foreign_agency_id) setSelectedKey(`${candidate.local_agency_id}:${candidate.foreign_agency_id}`);
  }, [candidateId]);
  const messagesQuery = useQuery<AgencyChatMessage[]>({
    queryKey: ['agencyMessages', selected?.local_agency_id, selected?.foreign_agency_id],
    queryFn: () => api.getAgencyMessagesForThread(selected!.local_agency_id, selected!.foreign_agency_id),
    enabled: !!selected,
    refetchInterval: 5000,
  });
  const invalidateThreads = () => client.invalidateQueries({ queryKey: ['agencyThreads'] });
  const invalidateMessages = () => client.invalidateQueries({ queryKey: ['agencyMessages'] });
  React.useEffect(() => {
    if (!selectedLocalId || !selectedForeignId || userRole === 'admin' || userRole === 'superadmin' || userRole === 'staff') return;
    void api.markAgencyThreadRead(selectedLocalId, selectedForeignId, localSide ? 'local' : 'foreign')
      .then(() => { void client.invalidateQueries({ queryKey: ['agencyThreads'] }); });
  }, [selectedLocalId, selectedForeignId, localSide, userRole, client]);
  const send = useMutation({
    mutationFn: async (text: string) => {
      if (!selected) throw new Error('Choose an agency conversation first.');
      return api.sendAgencyMessage({
        local_agency_id: selected.local_agency_id,
        foreign_agency_id: selected.foreign_agency_id,
        sender: localSide ? 'local-agency' : userRole === 'admin' || userRole === 'superadmin' || userRole === 'staff' ? 'admin' : 'foreign-agency',
        sender_id: user?.id ?? 'unknown',
        sender_name: user?.email ?? 'Agency user',
        message: text,
      });
    },
    onSuccess: () => { setMessage(''); void invalidateThreads(); void invalidateMessages(); },
  });

  return <div className="space-y-6">
    <PageHeader title="Agency conversations" description="Coordinate candidate handoffs between contracted local and foreign agencies." />
    <div className="grid gap-4 md:grid-cols-[300px_minmax(0,1fr)]">
      <Card><CardHeader><CardTitle className="text-base">Conversations</CardTitle></CardHeader><CardContent className="space-y-1">
        {threads.length === 0 ? <p className="text-sm text-muted-foreground">No conversations yet. Conversations appear when your agencies share a candidate or send a message.</p> : threads.map(thread => {
          const key = `${thread.local_agency_id}:${thread.foreign_agency_id}`;
          return <button key={key} type="button" onClick={() => setSelectedKey(key)} className={cn('w-full rounded-md border px-3 py-2 text-left', (selectedKey === key || (!selectedKey && selected?.id === thread.id)) ? 'bg-accent' : 'hover:bg-muted/50')}>
            <span className="block truncate text-sm font-medium">{localSide ? thread.foreign_agency_id : thread.local_agency_id}</span>
            <span className="block truncate text-xs text-muted-foreground">{thread.last_message?.message ?? 'No messages yet'}</span>
          </button>;
        })}
      </CardContent></Card>
      <Card className="flex min-h-[480px] flex-col"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4" />{selected ? `${selected.local_agency_id} · ${selected.foreign_agency_id}` : 'Conversation'}</CardTitle></CardHeader>
        <CardContent className="flex flex-1 flex-col">
          {!selected ? <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Select a conversation to view messages.</div> : <>
            <div className="flex-1 space-y-3 overflow-y-auto pb-4">
              {(messagesQuery.data ?? []).map(item => <div key={item.id} className={cn('max-w-[85%] rounded-md px-3 py-2 text-sm', item.sender === (localSide ? 'local-agency' : 'foreign-agency') ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted')}>
                <p className="mb-1 text-[11px] opacity-70">{item.sender_name} · {new Date(item.timestamp).toLocaleString()}</p><p className="whitespace-pre-wrap">{item.message}</p>
              </div>)}
              {messagesQuery.data?.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>}
            </div>
            <form className="space-y-2 border-t pt-3" onSubmit={event => { event.preventDefault(); const text = message.trim(); if (text) send.mutate(text); }}>
              <Textarea aria-label="Agency message" value={message} onChange={event => setMessage(event.target.value)} placeholder="Write a message" rows={3} />
              <div className="flex justify-end"><Button type="submit" disabled={!message.trim() || send.isPending}><Send className="mr-2 h-4 w-4" />Send</Button></div>
            </form>
          </>}
        </CardContent>
      </Card>
    </div>
  </div>;
};

export default AgencyConversationPage;
