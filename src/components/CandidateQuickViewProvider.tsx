import { createContext, useCallback, useContext, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Building2, Minus, PanelBottom, Users, X } from 'lucide-react';
import { Link, type LinkProps } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { getCandidates, getCocFacilities, getForeignAgencies, getLocalAgencies, getStaffUsers } from '@/lib/data-store';
import AdminCandidateDetail from '@/pages/AdminCandidateDetail';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { PopupDockContext, type PopupDockItem } from './popup-dock-context';
import EntityProfilePanel, { type EntityKind } from './EntityProfilePanel';

interface WorkspaceTab { id: string; entityId?: string; kind?: EntityKind; tab: string; stageId?: number; }
type OpenCandidate = (candidateId: string, options?: { tab?: string; stageId?: number }) => void;
const CandidateQuickViewContext = createContext<OpenCandidate | null>(null);
const EntityWorkspaceContext = createContext<((kind: EntityKind, id: string) => void) | null>(null);
export function CandidateQuickViewProvider({ children }: { children: ReactNode }) {
  const { user, userRole, viewAs, isDemo } = useAuth();
  const scope = `${isDemo}:${user?.id}:${userRole}:${viewAs?.userId}:${viewAs?.trackingCode}:${viewAs?.localAgencyId}:${viewAs?.foreignAgencyId}`;
  return <CandidateWorkspace key={scope}>{children}</CandidateWorkspace>;
}
function CandidateWorkspace({ children }: { children: ReactNode }) {
  const prefix = useId();
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeId, changeActiveId] = useState<string | null>(null);
  const [popups, setPopups] = useState<PopupDockItem[]>([]);
  const currentPopups = useRef(popups);
  currentPopups.current = popups;
  const register = useCallback((item: PopupDockItem) => setPopups(previous => [...previous.filter(entry => entry.id !== item.id), item]), []);
  const unregister = useCallback((id: string) => setPopups(previous => previous.filter(entry => entry.id !== id)), []);
  const activate = useCallback((id: string) => currentPopups.current.filter(popup => popup.id !== id && !popup.minimized).forEach(popup => popup.minimize()), []);
  const dock = useMemo(() => ({ register, unregister, activate }), [register, unregister, activate]);
  const setActiveId = (id: string | null) => { if (id) activate(id); changeActiveId(id); };
  const trigger = useRef<HTMLElement | null>(null);
  const openCandidate: OpenCandidate = (id, options) => {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setTabs(previous => previous.some(tab => tab.id === id)
      ? previous.map(tab => tab.id === id && options ? { ...tab, ...options } : tab)
      : [...previous, { id, tab: options?.tab ?? 'profile', stageId: options?.stageId }]);
    setActiveId(id);
  };
  const openEntity = (kind: EntityKind, entityId: string) => {
    const id = `${kind}:${entityId}`;
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setTabs(previous => previous.some(tab => tab.id === id) ? previous : [...previous, { id, entityId, kind, tab: 'overview' }]);
    setActiveId(id);
  };
  const candidates = getCandidates();
  const name = (id: string) => {
    const tab = tabs.find(tab => tab.id === id);
    if (tab?.kind) {
      if (tab.kind === 'staff-directory') return 'All staff';
      if (tab.kind === 'staff') return getStaffUsers().find(user => user.id === tab.entityId)?.email ?? 'Staff unavailable';
      const entities = tab.kind === 'local-agency' ? getLocalAgencies() : tab.kind === 'foreign-agency' ? getForeignAgencies() : getCocFacilities();
      return entities.find(entity => entity.id === tab.entityId)?.name ?? 'Agency / center unavailable';
    }
    const candidate = candidates.find(candidate => candidate.id === id);
    return candidate ? `${candidate.first_name} ${candidate.last_name}` : 'Candidate unavailable';
  };
  const updateTab = (id: string, changes: Partial<WorkspaceTab>) => setTabs(previous => previous.map(tab => tab.id === id ? { ...tab, ...changes } : tab));
  const close = (id: string) => {
    setTabs(previous => previous.filter(tab => tab.id !== id));
    if (activeId === id) setActiveId(tabs.filter(tab => tab.id !== id).at(-1)?.id ?? null);
  };
  const switchTab = (index: number) => {
    const tab = tabs[(index + tabs.length) % tabs.length];
    if (tab) { setActiveId(tab.id); document.getElementById(`${prefix}-tab-${tab.id}`)?.focus(); }
  };
  const candidateOnly = tabs.every(tab => !tab.kind);
  return <PopupDockContext.Provider value={dock}><EntityWorkspaceContext.Provider value={openEntity}><CandidateQuickViewContext.Provider value={openCandidate}>
    {children}
    {(tabs.length > 0 || popups.length > 0) && <div className="h-20" />}
    <Dialog workspaceManaged={false} modal={false} open={activeId !== null} onOpenChange={open => { if (!open) setActiveId(null); }}>
      <DialogContent keepMounted onInteractOutside={event => event.preventDefault()} className="bottom-20 left-1/2 top-auto flex h-[min(80vh,900px)] w-[calc(100%-1rem)] max-w-[1500px] translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl p-0 !animate-none [&>button:last-child]:hidden" onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}>
        <DialogHeader className="shrink-0 border-b bg-gradient-to-r from-primary/10 to-emerald-500/5 px-5 py-4">
          <div className="flex items-center justify-between gap-3"><DialogTitle className="flex items-center gap-2"><PanelBottom className="h-5 w-5 text-primary" />{candidateOnly ? 'Candidate workspace' : 'Profile workspace'}</DialogTitle><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setActiveId(null)}><Minus />Minimize to list</Button><Button size="icon" variant="ghost" aria-label={candidateOnly ? 'Close active candidate tab' : 'Close active profile tab'} onClick={() => activeId && close(activeId)}><X /></Button></div></div>
          <DialogDescription>Switch profiles using the tabs below. Minimize to browse the portal; your open profiles and unsaved edits stay here. Closing a tab discards its drafts.</DialogDescription>
        </DialogHeader>
        {tabs.map(tab => <div key={tab.id} id={`${prefix}-panel-${tab.id}`} role="tabpanel" aria-labelledby={`${prefix}-tab-${tab.id}`} hidden={tab.id !== activeId} className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          {tab.kind ? <EntityProfilePanel kind={tab.kind} entityId={tab.entityId!} section={tab.tab} onSectionChange={value => updateTab(tab.id, { tab: value })} onOpenEntity={openEntity} onOpenCandidate={openCandidate} />
            : <AdminCandidateDetail workspace={{ candidateId: tab.id, tab: tab.tab, stageId: tab.stageId, onTabChange: value => updateTab(tab.id, { tab: value, stageId: undefined }), onStageHandled: () => updateTab(tab.id, { stageId: undefined }), onMinimize: () => setActiveId(null) }} />}
        </div>)}
        <div className="shrink-0 border-t bg-card p-2"><div role="tablist" aria-label="Open candidate profiles" className="flex gap-2 overflow-x-auto">{tabs.map((tab, index) => <div key={tab.id} className="flex shrink-0 items-center rounded-lg border">        <button type="button" id={`${prefix}-tab-${tab.id}`} role="tab" aria-controls={`${prefix}-panel-${tab.id}`} aria-selected={tab.id === activeId} tabIndex={tab.id === activeId ? 0 : -1} className={`px-4 py-2 text-sm font-semibold ${tab.id === activeId ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setActiveId(tab.id)} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); switchTab(index + (event.key === 'ArrowRight' ? 1 : -1)); } }}>{name(tab.id)}</button><Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Close ${name(tab.id)}`} onClick={() => close(tab.id)}><X /></Button></div>)}</div></div>
      </DialogContent>
    </Dialog>
    {(tabs.length > 0 || popups.length > 0) && <nav aria-label="Candidate workspace dock" className="fixed inset-x-0 bottom-0 z-[60] flex items-center gap-2 border-t bg-card/95 p-3 shadow-[0_-8px_30px_hsl(var(--primary)/0.1)] backdrop-blur"><span className="hidden shrink-0 text-sm font-semibold sm:block"><PanelBottom className="mr-2 inline h-5 w-5 text-primary" />Open windows ({tabs.length + popups.length})</span><div className="flex flex-1 gap-2 overflow-x-auto">{tabs.map(tab => <div key={tab.id} className="flex shrink-0 items-center rounded-xl border"><Button variant={tab.id === activeId ? 'default' : 'ghost'} onClick={() => setActiveId(tab.id)}>{tab.kind === 'staff' || tab.kind === 'staff-directory' ? <Users className="h-4 w-4" /> : tab.kind ? <Building2 className="h-4 w-4" /> : null}{name(tab.id)}</Button><Button size="icon" variant="ghost" aria-label={`Close ${name(tab.id)} from dock`} onClick={() => close(tab.id)}><X /></Button></div>)}{popups.map(popup => <div key={popup.id} className="flex shrink-0 items-center rounded-xl border border-amber-500/40"><Button variant={popup.minimized ? 'ghost' : 'secondary'} onClick={popup.resume}><PanelBottom className="h-4 w-4" />{popup.title}{popup.minimized && <span className="text-xs text-muted-foreground">Minimized</span>}</Button><Button size="icon" variant="ghost" aria-label={`Close ${popup.title} from dock`} onClick={popup.close}><X /></Button></div>)}</div></nav>}
  </CandidateQuickViewContext.Provider></EntityWorkspaceContext.Provider></PopupDockContext.Provider>;
}
export const useCandidateWorkspace = () => useContext(CandidateQuickViewContext);
export const useEntityWorkspace = () => useContext(EntityWorkspaceContext);
export function EntityProfileButton({ kind, entityId, children, className }: { kind: EntityKind; entityId?: string; children: ReactNode; className?: string }) {
  const open = useEntityWorkspace();
  const { userRole } = useAuth();
  if (!open || !entityId || userRole !== 'superadmin' && kind !== 'staff' && kind !== 'staff-directory') return <span className={className}>{children}</span>;
  return <button type="button" className={className ?? 'text-left font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'} onClick={() => open(kind, entityId)}>{children}</button>;
}
export const useCandidateQuickView = (): OpenCandidate => {
  const context = useContext(CandidateQuickViewContext);
  if (!context) throw new Error('Candidate workspace provider is required.');
  return context;
};
export function CandidateName({ candidateId, children, className }: { candidateId: string; children: ReactNode; className?: string }) {
  const openCandidate = useCandidateQuickView();
  return <button type="button" className={className ?? 'text-left font-medium hover:text-primary hover:underline'} onClick={() => openCandidate(candidateId)}>{children}</button>;
}
export function CandidateWorkspaceLink({ candidateId, tab, stageId, onClick, ...props }: LinkProps & { candidateId: string; tab?: string; stageId?: number }) {
  const openCandidate = useCandidateWorkspace();
  return <Link {...props} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || !openCandidate || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || props.target === '_blank') return;
    event.preventDefault();
    openCandidate(candidateId, tab || stageId ? { tab: tab ?? 'timeline', stageId } : undefined);
  }} />;
}
