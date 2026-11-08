import { useId } from 'react';
import { FileText, Paperclip } from 'lucide-react';
import type { ChatMessage, Document } from '@/lib/types';
import { ALL_STAGES } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function ChatDocumentPicker({ documents, selected, onChange, disabled }: { documents: Document[]; selected: string[]; onChange: (ids: string[]) => void; disabled: boolean }) {
  const prefix = useId();
  return <Popover><PopoverTrigger asChild><Button type="button" variant="outline" size="sm" disabled={disabled}><Paperclip className="mr-2 h-4 w-4" />Tag files{selected.length ? ` (${selected.length})` : ''}</Button></PopoverTrigger>
    <PopoverContent align="start" className="max-w-[calc(100vw-2rem)]">
      <h3 className="mb-3 text-sm font-semibold">Candidate file context</h3>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {documents.map(document => <div key={document.id} className="flex items-start gap-2 border-b py-2 last:border-0">
          <Checkbox id={`${prefix}-${document.id}`} checked={selected.includes(document.id)} disabled={disabled || (selected.length >= 10 && !selected.includes(document.id))} onCheckedChange={checked => onChange(checked === true ? [...selected, document.id] : selected.filter(id => id !== document.id))} />
          <Label htmlFor={`${prefix}-${document.id}`} className="min-w-0 flex-1 cursor-pointer"><span className="block break-words text-sm">{document.file_name}</span><span className="text-xs text-muted-foreground">{ALL_STAGES.find(stage => stage.id === document.stage_id)?.title || 'Candidate document'}</span></Label>
        </div>)}
        {!documents.length && <p className="text-sm text-muted-foreground">No files recorded for this candidate.</p>}
      </div>
    </PopoverContent>
  </Popover>;
}

function documentLink(document?: Document) {
  const url = document?.public_url;
  if (!url || url.includes('placeholder')) return undefined;
  if (/^https?:\/\//i.test(url) || /^blob:/i.test(url) || /^\/(?!\/)/.test(url)) return url;
  return undefined;
}

export function ChatDocumentTags({ message, documents }: { message: ChatMessage; documents: Document[] }) {
  if (!message.document_tags?.length) return null;
  return <ul className="mt-2 space-y-2 border-t border-current/20 pt-2">
    {message.document_tags.map(tag => {
      const document = documents.find(item => item.id === tag.id && item.candidate_id === message.candidate_id);
      const url = documentLink(document);
      return <li key={tag.id} className="text-xs"><div className="flex items-start gap-1.5"><FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />{url ? <a className="break-all underline underline-offset-2" href={url} target="_blank" rel="noopener noreferrer">{tag.file_name}</a> : <span className="break-all">{tag.file_name}</span>}</div><p className="mt-1 opacity-75">{ALL_STAGES.find(stage => stage.id === tag.stage_id)?.title || 'Candidate document'}{!document ? ' · Document no longer available' : !url ? ' · File metadata only; no downloadable file stored' : ''}</p></li>;
    })}
  </ul>;
}