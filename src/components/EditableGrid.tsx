import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw } from 'lucide-react';
import { useLayoutEdit } from '@/lib/layout-edit';
import { DEMO_KEY_PREFIX, isDemoMode } from '@/lib/demo-mode';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type GridSpan = 4 | 6 | 8 | 12;
export interface GridItem { id: string; title: string; span?: GridSpan; node: React.ReactNode }

interface Saved { order: string[]; hidden: string[]; spans: Record<string, GridSpan> }

const SPAN_CLASS: Record<GridSpan, string> = { 4: 'lg:col-span-4', 6: 'lg:col-span-6', 8: 'lg:col-span-8', 12: 'lg:col-span-12' };
const SPAN_CYCLE: GridSpan[] = [12, 8, 6, 4];
const SPAN_LABEL: Record<GridSpan, string> = { 12: 'Full width', 8: 'Two thirds', 6: 'Half', 4: 'One third' };

const storageKey = (pageId: string) => `${isDemoMode() ? DEMO_KEY_PREFIX : ''}dawm_layout:${pageId}`;
const load = (pageId: string): Saved => {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(pageId)) ?? 'null') as Partial<Saved> | null;
    return { order: parsed?.order ?? [], hidden: parsed?.hidden ?? [], spans: parsed?.spans ?? {} };
  } catch {
    return { order: [], hidden: [], spans: {} };
  }
};

// An iPhone-style home screen: use the edit button in the top bar, then drag tiles, resize them or remove them.
const EditableGrid: React.FC<{ pageId: string; title?: string; items: GridItem[]; className?: string }> = ({ pageId, items: allItems, className }) => {
  const items = allItems.filter(item => !!item.node);
  const { editing, setEditable } = useLayoutEdit();
  const [saved, setSaved] = useState<Saved>(() => load(pageId));
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => { setEditable(true); return () => setEditable(false); }, [setEditable]);
  useEffect(() => { setSaved(load(pageId)); }, [pageId]);

  const update = useCallback((next: Saved) => {
    setSaved(next);
    try { localStorage.setItem(storageKey(pageId), JSON.stringify(next)); } catch { /* storage unavailable */ }
  }, [pageId]);

  const ids = items.map(item => item.id);
  const order = useMemo(() => [...saved.order.filter(id => ids.includes(id)), ...ids.filter(id => !saved.order.includes(id))], [saved.order, ids.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = new Map(items.map(item => [item.id, item]));
  const visible = order.filter(id => !saved.hidden.includes(id));
  const hidden = order.filter(id => saved.hidden.includes(id));

  const moveRelative = (id: string, targetId: string, after: boolean) => {
    const next = order.filter(item => item !== id);
    next.splice(next.indexOf(targetId) + (after ? 1 : 0), 0, id);
    update({ ...saved, order: next });
  };
  const step = (id: string, delta: number) => {
    const target = visible[visible.indexOf(id) + delta];
    if (target) moveRelative(id, target, delta > 0);
  };
  const resize = (id: string) => {
    const current = saved.spans[id] ?? byId.get(id)?.span ?? 12;
    update({ ...saved, spans: { ...saved.spans, [id]: SPAN_CYCLE[(SPAN_CYCLE.indexOf(current) + 1) % SPAN_CYCLE.length] } });
  };
  const hide = (id: string) => update({ ...saved, hidden: [...saved.hidden, id] });
  const show = (id: string) => update({ ...saved, hidden: saved.hidden.filter(item => item !== id) });
  const reset = () => update({ order: [], hidden: [], spans: {} });

  return (
    <div className={className}>
      {editing && (
        <div role="region" aria-label="Layout editor" className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-primary/60 bg-primary/5 p-3 text-sm motion-safe:animate-fade-up">
          <span className="font-medium">Editing layout</span>
          <span className="text-muted-foreground">Drag tiles to rearrange. Use the size and − buttons on each tile. Press Done or Esc to finish.</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {hidden.map(id => <Button key={id} size="sm" variant="outline" onClick={() => show(id)}><Plus className="mr-1 h-3.5 w-3.5" />{byId.get(id)?.title}</Button>)}
            <Button size="sm" variant="ghost" onClick={reset}><RotateCcw className="mr-1 h-3.5 w-3.5" />Reset layout</Button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:grid-flow-row-dense">
        {visible.map((id, index) => {
          const item = byId.get(id);
          if (!item) return null;
          const span = saved.spans[id] ?? item.span ?? 12;
          return (
            <div
              key={id}
              data-tour={`${pageId}-${id}`}
              className={cn('relative min-w-0 col-span-1', SPAN_CLASS[span], editing && 'cursor-grab rounded-xl outline outline-2 outline-offset-4 outline-primary/30 motion-safe:animate-jiggle', dragId === id && 'opacity-40')}
              style={editing ? { animationDelay: `${(index % 4) * -220}ms` } : undefined}
              draggable={editing}
              tabIndex={editing ? 0 : undefined}
              aria-label={editing ? `${item.title} tile` : undefined}
              onDragStart={event => { setDragId(id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id); }}
              onDragEnter={() => { if (dragId && dragId !== id) moveRelative(dragId, id, visible.indexOf(dragId) < index); }}
              onDragOver={event => { if (editing) event.preventDefault(); }}
              onDragEnd={() => setDragId(null)}
              onDrop={event => { event.preventDefault(); setDragId(null); }}
              onKeyDown={event => {
                if (!editing || event.target !== event.currentTarget) return;
                if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); step(id, -1); }
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); step(id, 1); }
              }}
            >
              {editing && (
                <>
                  <button type="button" aria-label={`Remove ${item.title}`} title="Remove from view" onClick={() => hide(id)} className="absolute -left-3 -top-3 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md"><Minus className="h-4 w-4" /></button>
                  <div className="absolute -top-3 right-0 z-20 flex items-center gap-1 rounded-full border bg-card px-1 py-0.5 text-xs shadow-md">
                    <button type="button" aria-label={`Move ${item.title} earlier`} onClick={() => step(id, -1)} className="rounded-full p-1 hover:bg-muted"><ChevronLeft className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label={`Resize ${item.title}`} title={SPAN_LABEL[span]} onClick={() => resize(id)} className="rounded-full px-2 py-0.5 font-medium hover:bg-muted">{SPAN_LABEL[span]}</button>
                    <button type="button" aria-label={`Move ${item.title} later`} onClick={() => step(id, 1)} className="rounded-full p-1 hover:bg-muted"><ChevronRight className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="absolute inset-0 z-10" aria-hidden="true" />
                </>
              )}
              <div className={cn('min-w-0', editing && 'pointer-events-none select-none')}>{item.node}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EditableGrid;
