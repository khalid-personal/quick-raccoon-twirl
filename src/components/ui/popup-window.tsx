import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Move } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import JourneyArrowField from '../JourneyArrowField';

export const popupWindowStyle: CSSProperties = {
  resize: 'both',
  overflow: 'auto',
  overscrollBehavior: 'contain',
  minWidth: 'min(20rem, calc(100vw - 2rem))',
  minHeight: 'min(12rem, calc(100dvh - 7rem))',
  maxHeight: 'calc(100dvh - 7rem)',
};
export const popupCloseClassName = 'text-red-600 hover:bg-red-100 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950';
export const popupMinimizeClassName = 'text-yellow-600 hover:bg-yellow-100 hover:text-yellow-700 dark:text-yellow-400 dark:hover:bg-yellow-950';

export function PopupResizeControl({ movable = true }: { movable?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const mobileRef = useRef<HTMLSpanElement>(null);
  const mobile = useIsMobile();
  const descriptionId = useId();
  useEffect(() => {
    const popup = (ref.current ?? mobileRef.current)?.closest<HTMLElement>('[data-popup-window]');
    if (!popup) return;
    if (mobile) {
      const viewport = window.visualViewport;
      const update = () => {
        popup.style.setProperty('--popup-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
        popup.style.setProperty('--popup-viewport-top', `${viewport?.offsetTop ?? 0}px`);
      };
      update();
      viewport?.addEventListener('resize', update);
      viewport?.addEventListener('scroll', update);
      window.addEventListener('resize', update);
      return () => { viewport?.removeEventListener('resize', update); viewport?.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
    }
    // Keep the initial caller-specified size, but remove its resize ceiling.
    const width = popup.getBoundingClientRect().width;
    if (width) popup.style.width = `${width}px`;
    popup.style.maxWidth = 'calc(100vw - 2rem)';
  }, [mobile]);
  const resize = (widthChange: number, heightChange: number) => {
    const popup = ref.current?.closest<HTMLElement>('[data-popup-window]');
    if (!popup) return;
    const bounds = popup.getBoundingClientRect();
    if (widthChange) popup.style.width = `${Math.max(Math.min(320, window.innerWidth - 32), Math.min(window.innerWidth - 32, (parseFloat(popup.style.width) || bounds.width) + widthChange))}px`;
    if (heightChange) popup.style.height = `${Math.max(Math.min(192, window.innerHeight - 32), Math.min(window.innerHeight - 32, (parseFloat(popup.style.height) || bounds.height) + heightChange))}px`;
    if (popup.dataset.popupMoved === 'true') movePopup(popup, bounds.left, bounds.top);
  };
  if (mobile) return <><span ref={mobileRef} aria-hidden="true" className="hidden" />{movable && <JourneyArrowField compact paused />}</>;
  return <>
    {movable && <JourneyArrowField compact paused />}
    {movable && <PopupMoveControl />}
    <span id={descriptionId} className="sr-only">Use arrow keys to resize width or height. Press Enter or Space to enlarge.</span>
    <button ref={ref} type="button" aria-label="Resize window" aria-describedby={descriptionId}
      title="Resize with arrow keys, or drag the bottom-right corner"
      className="absolute bottom-2 right-5 z-10 rounded bg-background/90 p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => resize(64, 64)}
      onKeyDown={event => {
        const changes: Record<string, [number, number]> = { ArrowLeft: [-32, 0], ArrowRight: [32, 0], ArrowUp: [0, -32], ArrowDown: [0, 32] };
        const change = changes[event.key];
        if (change) { event.preventDefault(); event.stopPropagation(); resize(...change); }
      }}>
      <Maximize2 aria-hidden="true" className="h-3 w-3" />
    </button>
    <CornerResizeHandles control={ref} />
  </>;
}

export function PopupMoveControl() {
  const ref = useRef<HTMLButtonElement>(null);
  const mobile = useIsMobile();
  const descriptionId = useId();
  useEffect(() => {
    const popup = ref.current?.closest<HTMLElement>('[data-popup-window]');
    if (!popup || mobile || popup.classList.contains('portal-popup-popover')) return;
    let drag: { pointerId: number; x: number; y: number; left: number; top: number } | null = null;
    const move = (left: number, top: number) => movePopup(popup, left, top);
    const down = (event: PointerEvent) => {
      const target = event.target;
      if (event.button !== 0 || !(target instanceof Element)) return;
      const control = target.closest('[data-popup-move-control]');
      const header = target.closest('.portal-popup-header, .portal-popup-title, [data-popup-drag-handle], header');
      if (!control && (!header || target.closest('button, a, input, textarea, select, [role="tab"], [role="button"], [contenteditable="true"]'))) return;
      if (target.closest('[data-popup-window]') !== popup) return;
      const rect = popup.getBoundingClientRect();
      event.preventDefault();
      popup.setPointerCapture(event.pointerId);
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      popup.dataset.popupDragging = 'true';
    };
    const motion = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      move(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y);
    };
    const stop = () => {
      if (drag && popup.hasPointerCapture(drag.pointerId)) popup.releasePointerCapture(drag.pointerId);
      drag = null;
      delete popup.dataset.popupDragging;
    };
    const fit = () => {
      if (popup.dataset.popupMoved !== 'true') return;
      const rect = popup.getBoundingClientRect();
      move(rect.left, rect.top);
    };
    popup.dataset.popupMovable = 'true';
    popup.addEventListener('pointerdown', down);
    popup.addEventListener('pointermove', motion);
    popup.addEventListener('pointerup', stop);
    popup.addEventListener('pointercancel', stop);
    popup.addEventListener('lostpointercapture', stop);
    window.addEventListener('resize', fit);
    return () => {
      stop();
      delete popup.dataset.popupMovable;
      popup.removeEventListener('pointerdown', down);
      popup.removeEventListener('pointermove', motion);
      popup.removeEventListener('pointerup', stop);
      popup.removeEventListener('pointercancel', stop);
      popup.removeEventListener('lostpointercapture', stop);
      window.removeEventListener('resize', fit);
      // Mobile sheets/dialogs must resume their screen-fitting layout.
      if (window.innerWidth < 768 && popup.dataset.popupMoved === 'true') {
        for (const property of ['position', 'left', 'top', 'right', 'bottom', 'transform', 'translate', 'margin', 'width', 'height', 'animation', '--popup-left', '--popup-top']) popup.style.removeProperty(property);
        delete popup.dataset.popupMoved;
      }
    };
  }, [mobile]);
  if (mobile) return null;
  return <>
    <span id={descriptionId} className="sr-only">Drag this control or the window heading to move. Use arrow keys to move, Shift for larger steps, or Home to center.</span>
    <button ref={ref} type="button" data-popup-move-control="" aria-label="Move window" aria-describedby={descriptionId}
      className="portal-popup-move absolute z-10 flex h-8 w-8 touch-none items-center justify-center rounded-lg border border-primary/20 bg-card text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title="Drag the heading to move · arrow keys here to reposition"
      onKeyDown={event => {
        const popup = ref.current?.closest<HTMLElement>('[data-popup-window]');
        if (!popup) return;
        const step = event.shiftKey ? 64 : 16;
        const changes: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        const rect = popup.getBoundingClientRect();
        if (event.key === 'Home') { event.preventDefault(); event.stopPropagation(); movePopup(popup, (window.innerWidth - rect.width) / 2, (window.innerHeight - rect.height) / 2); }
        else if (changes[event.key]) { event.preventDefault(); event.stopPropagation(); const [dx, dy] = changes[event.key]; movePopup(popup, rect.left + dx, rect.top + dy); }
      }}><Move className="h-4 w-4" aria-hidden="true" /></button>
  </>;
}

function movePopup(popup: HTMLElement, left: number, top: number) {
  const rect = popup.getBoundingClientRect();
  const width = Math.min(rect.width, window.innerWidth - 32);
  const height = Math.min(rect.height, window.innerHeight - 32);
  const x = Math.max(16, Math.min(window.innerWidth - width - 16, left));
  const y = Math.max(16, Math.min(window.innerHeight - height - 16, top));
  Object.assign(popup.style, {
    position: 'fixed', transform: 'none', translate: 'none', animation: 'none', margin: '0', right: 'auto', bottom: 'auto',
    left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px`,
  });
  popup.style.setProperty('--popup-left', `${x}px`);
  popup.style.setProperty('--popup-top', `${y}px`);
  popup.dataset.popupMoved = 'true';
}

const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
type Corner = typeof corners[number];

function CornerResizeHandles({ control }: { control: RefObject<HTMLButtonElement> }) {
  const [bounds, setBounds] = useState<{ left: number; top: number; right: number; bottom: number } | null>(null);
  const drag = useRef<{ corner: Corner; x: number; y: number; left: number; top: number; right: number; bottom: number } | null>(null);
  useEffect(() => {
    const popup = control.current?.closest<HTMLElement>('[data-popup-window]');
    if (!popup) return;
    const measure = () => {
      const rect = popup.getBoundingClientRect();
      const next = rect.width && rect.height ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null;
      setBounds(previous => previous?.left === next?.left && previous?.top === next?.top && previous?.right === next?.right && previous?.bottom === next?.bottom ? previous : next);
    };
    measure();
    const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : undefined;
    resize?.observe(popup);
    const mutation = new MutationObserver(measure);
    mutation.observe(popup, { attributes: true });
    popup.addEventListener('animationend', measure);
    popup.addEventListener('transitionend', measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { resize?.disconnect(); mutation.disconnect(); popup.removeEventListener('animationend', measure); popup.removeEventListener('transitionend', measure); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [control]);
  if (!bounds) return null;
  return createPortal(<>{corners.map(corner => {
    const west = corner.endsWith('left'), north = corner.startsWith('top');
    return <button key={corner} type="button" aria-label={`Resize window from ${corner} corner`}
      className="portal-popup-corner fixed z-[80] h-4 w-4 touch-none rounded-sm border border-primary/40 bg-card/90 text-primary opacity-60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      tabIndex={-1} title={`Drag the ${corner} corner to resize. Use Resize window for keyboard controls.`}
      style={{ pointerEvents: 'auto', left: (west ? bounds.left : bounds.right) - 8, top: (north ? bounds.top : bounds.bottom) - 8, cursor: west === north ? 'nwse-resize' : 'nesw-resize' }}
      onPointerDown={event => {
        if (event.button !== 0) return;
        const popup = control.current?.closest<HTMLElement>('[data-popup-window]');
        if (!popup) return;
        event.preventDefault(); event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const rect = popup.getBoundingClientRect();
        drag.current = { corner, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      }}
      onPointerMove={event => {
        const start = drag.current;
        const popup = control.current?.closest<HTMLElement>('[data-popup-window]');
        if (!start || start.corner !== corner || !popup) return;
        const styles = getComputedStyle(popup);
        const minWidth = Math.min(window.innerWidth - 32, parseFloat(styles.minWidth) || 320);
        const minHeight = Math.min(window.innerHeight - 32, parseFloat(styles.minHeight) || 192);
        const maxWidth = Math.min(window.innerWidth - 32, parseFloat(styles.maxWidth) || window.innerWidth - 32);
        const maxHeight = Math.min(window.innerHeight - 32, parseFloat(styles.maxHeight) || window.innerHeight - 32);
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        const width = Math.max(minWidth, Math.min(maxWidth, (west ? start.right - 16 : window.innerWidth - 16 - start.left), start.right - start.left + (west ? -dx : dx)));
        const height = Math.max(minHeight, Math.min(maxHeight, (north ? start.bottom - 16 : window.innerHeight - 16 - start.top), start.bottom - start.top + (north ? -dy : dy)));
        Object.assign(popup.style, { position: 'fixed', transform: 'none', translate: 'none', margin: '0', right: 'auto', bottom: 'auto',
          left: `${west ? start.right - width : start.left}px`, top: `${north ? start.bottom - height : start.top}px`, width: `${width}px`, height: `${height}px` });
        popup.style.setProperty('--popup-left', `${west ? start.right - width : start.left}px`);
        popup.style.setProperty('--popup-top', `${north ? start.bottom - height : start.top}px`);
        if (!popup.classList.contains('portal-popup-popover')) popup.dataset.popupMoved = 'true';
        const rect = popup.getBoundingClientRect();
        setBounds({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
      }}
      onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => { drag.current = null; }}
      onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const resize = control.current;
        resize?.dispatchEvent(new KeyboardEvent('keydown', { key: event.key, bubbles: true }));
      }}>
      <span aria-hidden="true" className="block text-[10px] leading-none">+</span>
    </button>;
  })}</>, document.body);
}
