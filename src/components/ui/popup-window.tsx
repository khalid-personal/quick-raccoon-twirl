import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { Maximize2 } from 'lucide-react';

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

export function PopupResizeControl() {
  const ref = useRef<HTMLButtonElement>(null);
  const descriptionId = useId();
  useEffect(() => {
    const popup = ref.current?.closest<HTMLElement>('[data-popup-window]');
    if (!popup) return;
    // Keep the initial caller-specified size, but remove its resize ceiling.
    const width = popup.getBoundingClientRect().width;
    if (width) popup.style.width = `${width}px`;
    popup.style.maxWidth = 'calc(100vw - 2rem)';
  }, []);
  const resize = (widthChange: number, heightChange: number) => {
    const popup = ref.current?.closest<HTMLElement>('[data-popup-window]');
    if (!popup) return;
    const bounds = popup.getBoundingClientRect();
    if (widthChange) popup.style.width = `${Math.max(Math.min(320, window.innerWidth - 32), Math.min(window.innerWidth - 32, (parseFloat(popup.style.width) || bounds.width) + widthChange))}px`;
    if (heightChange) popup.style.height = `${Math.max(Math.min(192, window.innerHeight - 32), Math.min(window.innerHeight - 32, (parseFloat(popup.style.height) || bounds.height) + heightChange))}px`;
  };
  return <>
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
  </>;
}
