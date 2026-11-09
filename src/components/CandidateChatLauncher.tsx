import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, MessageCircle, Minus, Plus, X } from 'lucide-react';
import { usePopupScrollLock } from '@/hooks/use-popup-scroll-lock';
import { PopupResizeControl, popupCloseClassName, popupMinimizeClassName, popupWindowStyle } from './ui/popup-window';
import { useAuth } from '@/lib/auth-context';
import { getCandidateChatInbox } from '@/lib/api/chat-launcher';
import { getCandidateDetail } from '@/lib/api/candidate-crud';
import { Button } from './ui/button';
import { Input } from './ui/input';
import CandidateAvatar from './CandidateAvatar';
import AdminChatViewer from './AdminChatViewer';
import CandidateChat from './CandidateChat';

export default function CandidateChatLauncher() {
  const { user, userRole, viewAs, isAuthenticated, userLocalAgencyId, userForeignAgencyId } = useAuth();
  const [open, setOpen] = useState(false);
  const [newChat, setNewChat] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const scope = `${viewAs?.userId ?? user?.id}:${userRole}:${userLocalAgencyId}:${userForeignAgencyId}`;
  const allowed = isAuthenticated && !!userRole && !['viewer', 'auditor'].includes(userRole);
  usePopupScrollLock(allowed && open);
  useEffect(() => { setOpen(false); setSelected(null); setNewChat(false); setSearch(''); }, [scope]);
  const inbox = useQuery({ queryKey: ['candidate-chat-launcher', scope], queryFn: getCandidateChatInbox, enabled: allowed, refetchInterval: 10000 });
  const candidate = useQuery({ queryKey: ['launcher-candidate', scope, selected],
    queryFn: async () => {
      const current = await getCandidateChatInbox();
      if (!current.candidates.some(candidate => candidate.id === selected)) throw new Error('This conversation is not available to your account.');
      const detail = await getCandidateDetail(selected!);
      if (!detail) throw new Error('Candidate no longer available.');
      return detail;
    }, enabled: allowed && open && !!selected });
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open]);
  if (!allowed) return null;
  const matches = inbox.data?.candidates.filter(candidate => `${candidate.first_name} ${candidate.last_name} ${candidate.passport_number} ${candidate.tracking_code}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  const pick = (id: string) => { setSelected(id); setNewChat(false); };
  return <div data-chat-open={open} className="candidate-chat-launcher fixed bottom-20 right-4 z-[55] sm:right-6">
    {open && <section id="candidate-chat-popup" data-popup-window="" data-popup-layout="dialog" role="dialog" aria-modal="false" aria-label="Candidate chats" style={{ ...popupWindowStyle, maxHeight: 'calc(100dvh - 10rem)' }} className="portal-popup relative mb-3 flex w-[calc(100vw-2rem)] max-w-md flex-col border bg-card pb-8">
      <header className="portal-card-heading flex flex-wrap items-center gap-2 p-4 sm:pr-14">
        {(selected || newChat) && <Button variant="ghost" size="icon" aria-label="Back to threads" onClick={() => { setSelected(null); setNewChat(false); }}><ArrowLeft className="h-4 w-4" /></Button>}
        <div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{selected && candidate.data ? `${candidate.data.first_name} ${candidate.data.last_name}` : selected ? 'Conversation' : newChat ? 'New candidate chat' : 'Candidate chats'}</h2>
          {selected && candidate.data && <p className="font-mono text-xs text-muted-foreground">{candidate.data.tracking_code}</p>}</div>
        {!selected && !newChat && <Button size="sm" variant="outline" onClick={() => { setNewChat(true); setSearch(''); }}><Plus className="mr-1 h-4 w-4" />New chat</Button>}
        <Button size="icon" variant="ghost" className={popupMinimizeClassName} aria-label="Minimize chats" onClick={() => setOpen(false)}><Minus className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className={popupCloseClassName} aria-label="Close chats" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
      </header>
      <div className="min-h-0 overflow-y-auto p-3">
        {selected ? candidate.isLoading ? <Loader2 aria-label="Loading conversation" className="m-5 h-6 w-6 animate-spin" />
          : candidate.isError || !candidate.data ? <p role="alert">Could not open this conversation. Check your account and try again.</p>
            : userRole === 'candidate' ? <CandidateChat candidateId={candidate.data.id} candidateName={`${candidate.data.first_name} ${candidate.data.last_name}`} candidateEmail={candidate.data.email ?? ''} />
              : <AdminChatViewer candidate={candidate.data} />
          : inbox.isLoading ? <Loader2 aria-label="Loading chats" className="m-5 h-6 w-6 animate-spin" />
            : inbox.isError ? <p role="alert" className="p-4 text-destructive">Could not load candidate chats. Try again after checking your account.</p>
              : newChat ? <>
                <Input aria-label="Search candidates for chat" placeholder="Name, passport or tracking code" value={search} onChange={event => setSearch(event.target.value)} />
                <div className="mt-3 space-y-2">{matches.map(candidate => <button key={candidate.id} onClick={() => pick(candidate.id)} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:bg-muted"><CandidateAvatar candidate={candidate} className="h-9 w-9" /><span><span className="block font-medium">{candidate.first_name} {candidate.last_name}</span><span className="font-mono text-xs text-muted-foreground">{candidate.tracking_code}</span></span></button>)}</div>
                {!matches.length && <p className="p-4 text-sm text-muted-foreground">{inbox.data?.candidates.length ? 'No candidates match your search.' : 'No candidates are available to your account.'}</p>}
              </> : <div className="space-y-2">
                {!inbox.data?.threads.length && <p className="p-5 text-sm text-muted-foreground">No conversations yet. Choose New chat to contact an available candidate.</p>}
                {inbox.data?.threads.map(thread => <button key={thread.candidate.id} onClick={() => pick(thread.candidate.id)} className="flex w-full items-start gap-3 rounded-xl border p-3 text-left hover:bg-muted">
                  <CandidateAvatar candidate={thread.candidate} className="h-10 w-10" /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{thread.candidate.first_name} {thread.candidate.last_name}</span><span className="block font-mono text-xs text-muted-foreground">{thread.candidate.tracking_code}</span><span className="mt-1 block truncate text-sm text-muted-foreground">{thread.latest.message}</span></span>
                  {!!thread.unread && <span className="rounded-full bg-primary px-2 py-1 text-xs text-primary-foreground">{thread.unread}</span>}
                </button>)}
              </div>}
      </div>
      <PopupResizeControl />
    </section>}
    <Button data-tour="chat-launcher" aria-label="Open candidate chats" aria-expanded={open} aria-controls={open ? 'candidate-chat-popup' : undefined}
      className="relative ml-auto flex h-14 w-14 rounded-full shadow-xl" onClick={() => setOpen(value => !value)}><MessageCircle className="!h-6 !w-6" />
      {!!inbox.data?.unread && <span className="absolute -right-1 -top-1 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">{inbox.data.unread}</span>}</Button>
  </div>;
}
