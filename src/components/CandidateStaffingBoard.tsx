import { useState } from 'react';
import { BriefcaseBusiness, Check, Languages, Save, Users, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { CandidateSummary } from '@/lib/types';
import { candidateWorkType, fillStaffingSelection, type StaffingFilters } from '@/lib/candidate-staffing';
import { DEMO_KEY_PREFIX, isDemoMode } from '@/lib/demo-mode';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CandidateAvatar from './CandidateAvatar';

interface StaffingDraft { candidateIds: string[]; target: number; savedAt: string }
const draftKey = (agencyId: string) => `${isDemoMode() ? DEMO_KEY_PREFIX : ''}dawm_staffing_draft:${agencyId}`;
const loadDraft = (agencyId: string): StaffingDraft | null => {
  const raw = localStorage.getItem(draftKey(agencyId));
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || !('candidateIds' in value) || !Array.isArray(value.candidateIds)
      || !value.candidateIds.every(id => typeof id === 'string') || !('target' in value) || typeof value.target !== 'number'
      || !Number.isInteger(value.target) || value.target < 1 || value.target > 500 || !('savedAt' in value) || typeof value.savedAt !== 'string') {
      throw new Error('The saved staffing draft is invalid.');
    }
    return { candidateIds: value.candidateIds, target: value.target, savedAt: value.savedAt };
  } catch (error) {
    console.error('[CandidateStaffingBoard] Could not load staffing draft', error);
    toast.error('Could not read the saved staffing draft. Save a new draft to replace it.');
    return null;
  }
};

export default function CandidateStaffingBoard({ agencyId, candidates, scopeCandidates, filters, onFiltersChange, onOpen }: {
  agencyId: string; candidates: CandidateSummary[]; scopeCandidates: CandidateSummary[];
  filters: StaffingFilters; onFiltersChange: (filters: StaffingFilters) => void; onOpen: (candidate: CandidateSummary) => void;
}) {
  const [draft] = useState(() => loadDraft(agencyId));
  const [ids, setIds] = useState(draft?.candidateIds ?? []);
  const [targetInput, setTargetInput] = useState(String(draft?.target ?? 10));
  const [savedAt, setSavedAt] = useState(draft?.savedAt ?? '');
  const [dirty, setDirty] = useState(false);
  const target = Number(targetInput);
  const validTarget = Number.isInteger(target) && target >= 1 && target <= 500;
  const selected = scopeCandidates.filter(candidate => ids.includes(candidate.id));
  const selectedIds = selected.map(candidate => candidate.id);
  const workTypes = [...new Set(scopeCandidates.map(candidateWorkType))].sort();
  const languages = [...new Set(scopeCandidates.flatMap(candidate => candidate.languages?.map(language => language.trim()).filter(Boolean) ?? []))].sort();
  const remaining = validTarget ? Math.max(0, target - selected.length) : 0;
  const toggle = (candidate: CandidateSummary) => {
    if (ids.includes(candidate.id)) setIds(ids.filter(id => id !== candidate.id));
    else if (!validTarget || selected.length >= target) { toast.error('Your worker slots are full. Increase the requested count or remove a worker.'); return; }
    else setIds([...selectedIds, candidate.id]);
    setDirty(true);
  };
  const save = () => {
    if (!validTarget || selected.length > target) { toast.error('Choose a valid worker count and remove any workers above that count.'); return; }
    try {
      const at = new Date().toISOString();
      localStorage.setItem(draftKey(agencyId), JSON.stringify({ candidateIds: selectedIds, target, savedAt: at } satisfies StaffingDraft));
      setSavedAt(at); setDirty(false);
      toast.success('Staffing draft saved in this browser. No hiring, payment or journey stage was changed.');
    } catch (error) { console.error('[CandidateStaffingBoard] Could not save draft', error); toast.error('Could not save the staffing draft. Check browser storage and try again.'); }
  };
  return <Card id="worker-selection-board">
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Worker selection board</CardTitle>
      <CardDescription>Build a staffing shortlist using candidate pictures, job types and spoken languages. Only candidates assigned or shared with your agency appear. Shortlisting does not hire a worker, charge money, or complete a journey stage.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div><Label htmlFor="staffing-target">How many workers do you need?</Label><Input id="staffing-target" type="number" min={1} max={500} value={targetInput} onChange={event => { setTargetInput(event.target.value); setDirty(true); }} /></div>
        <div><Label htmlFor="staffing-work-type" className="flex items-center gap-1"><BriefcaseBusiness className="h-4 w-4" />Job / work type</Label><Select value={filters.workType || 'all'} onValueChange={value => onFiltersChange({ ...filters, workType: value === 'all' ? '' : value })}><SelectTrigger id="staffing-work-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All job types</SelectItem>{workTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="staffing-language" className="flex items-center gap-1"><Languages className="h-4 w-4" />Spoken language</Label><Select value={filters.language || 'all'} onValueChange={value => onFiltersChange({ ...filters, language: value === 'all' ? '' : value })}><SelectTrigger id="staffing-language"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All languages</SelectItem>{languages.map(language => <SelectItem key={language} value={language}>{language}</SelectItem>)}</SelectContent></Select></div>
      </div>
      {(!validTarget || selected.length > target) && <p role="alert" className="text-sm text-destructive">Choose 1-500 workers. Remove extra selections before reducing your target.</p>}
      <div className="space-y-3 rounded-xl border bg-primary/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{selected.length} selected{validTarget && ` / ${target} needed`} · {remaining} spots left</p><Badge variant="outline">{dirty ? 'Unsaved changes' : savedAt ? 'Saved in this browser' : 'Draft shortlist'}</Badge></div>
        <Progress value={validTarget ? Math.min(100, selected.length / target * 100) : 0} aria-label="Staffing request filled" />
        <div className="flex flex-wrap gap-2">
          {selected.map(candidate => <button key={candidate.id} type="button" className="flex items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-3 text-xs hover:bg-accent" aria-label={`Remove ${candidate.first_name} ${candidate.last_name} from shortlist`} onClick={() => toggle(candidate)}><CandidateAvatar candidate={candidate} className="h-8 w-8" />{candidate.first_name} {candidate.last_name} - remove</button>)}
          {!selected.length && <p className="text-sm text-muted-foreground">Pick candidate cards below to fill your worker slots.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!validTarget || !remaining || !candidates.length} onClick={() => { setIds(fillStaffingSelection(selectedIds, candidates, target)); setDirty(true); }}><UserPlus className="mr-1 h-4 w-4" />Fill available slots</Button>
          <Button size="sm" variant="outline" onClick={() => { setIds([]); setDirty(true); }}>Clear shortlist</Button>
          <Button size="sm" variant="outline" disabled={!validTarget || selected.length > target} onClick={save}><Save className="mr-1 h-4 w-4" />Save draft</Button>
          {(filters.workType || filters.language) && <Button size="sm" variant="ghost" onClick={() => onFiltersChange({ workType: '', language: '' })}>Clear job / language filters</Button>}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{candidates.length} matching candidates. Search and status filters in the candidate table below also apply here. Payment selection is separate from this shortlist.</p>
      <div className="grid max-h-[36rem] grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-4">
        {candidates.map(candidate => {
          const checked = selectedIds.includes(candidate.id);
          return <article key={candidate.id} className={`rounded-xl border p-4 ${checked ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-background'}`}>
            <button type="button" aria-pressed={checked} aria-label={`${checked ? 'Unselect' : 'Select'} ${candidate.first_name} ${candidate.last_name} for shortlist`} onClick={() => toggle(candidate)} className="flex w-full items-center gap-3 text-left">
              <CandidateAvatar candidate={candidate} className="h-16 w-16 shrink-0" />
              <div className="min-w-0"><p className="font-semibold">{candidate.first_name} {candidate.last_name}</p><p className="text-xs text-muted-foreground">{candidate.tracking_code}</p><p className="mt-1 flex items-center gap-1 text-xs font-medium text-primary">{checked && <Check className="h-3 w-3" />}{checked ? 'Selected' : 'Pick worker'}</p></div>
            </button>
            <p className="mt-3 flex items-center gap-1 text-sm"><BriefcaseBusiness className="h-4 w-4 shrink-0" />{candidateWorkType(candidate)}</p>
            <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground"><Languages className="h-4 w-4 shrink-0" />{candidate.languages?.join(', ') || 'Languages not recorded'}</p>
            <div className="mt-3 flex items-center justify-between gap-2"><Badge variant="outline">{candidate.overall_status}</Badge><Button size="sm" variant="ghost" onClick={() => onOpen(candidate)}>Profile</Button></div>
          </article>;
        })}
      </div>
      {!candidates.length && <p className="py-4 text-center text-sm text-muted-foreground">No workers match these filters. Try another job type or language.</p>}
    </CardContent>
  </Card>;
}
