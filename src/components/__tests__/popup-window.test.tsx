// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePopupScrollLock } from '@/hooks/use-popup-scroll-lock';
import { PopupDockContext, type PopupDockItem } from '../popup-dock-context';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { Popover, PopoverContent } from '../ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../ui/sheet';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '../ui/alert-dialog';

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  document.body.style.overflow = 'scroll';
  document.body.style.overscrollBehavior = 'auto';
  document.documentElement.style.overflow = 'auto';
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  expect(document.body.style.overflow).toBe('scroll');
  expect(document.documentElement.style.overflow).toBe('auto');
  expect(document.body.style.overscrollBehavior).toBe('auto');
  container.remove();
  document.body.removeAttribute('style'); document.documentElement.removeAttribute('style');
  vi.restoreAllMocks();
});
function Lock({ visible }: { visible: boolean }) { usePopupScrollLock(visible); return null; }
const render = async (children: React.ReactNode) => { await act(async () => root.render(children)); };
describe('popup windows', () => {
  it('restores original scrolling only after the last visible window closes, including StrictMode cleanup', async () => {
    const windows = (first: boolean, second: boolean) => <StrictMode><Lock visible={first} /><Lock visible={second} /></StrictMode>;
    await render(windows(true, true));
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
    await render(windows(false, true));
    expect(document.body.style.overflow).toBe('hidden');
    await render(windows(false, false));
    expect(document.body.style.overflow).toBe('scroll');
    await render(windows(true, false));
    await render(null);
    expect(document.body.style.overflow).toBe('scroll');
  });
  it('keeps nested non-modal dialogs locked while either remains visible', async () => {
    const dialogs = (outer: boolean, inner: boolean) => <Dialog open={outer} modal={false}>
      <DialogContent keepMounted><DialogTitle>Outer</DialogTitle><DialogDescription>Workspace</DialogDescription>
        <Dialog open={inner} modal={false}><DialogContent><DialogTitle>Inner</DialogTitle><DialogDescription>Editor</DialogDescription></DialogContent></Dialog>
      </DialogContent>
    </Dialog>;
    await render(dialogs(true, true));
    await render(dialogs(false, true));
    expect(document.body.style.overflow).toBe('hidden');
    await render(dialogs(false, false));
    expect(document.body.style.overflow).toBe('scroll');
  });
  it('releases on minimize, retains drafts, resumes, and offers colored accessible resizing controls', async () => {
    let item: PopupDockItem | undefined;
    const dock = { register: (value: PopupDockItem) => { item = value; }, unregister: vi.fn(), activate: vi.fn() };
    await render(<PopupDockContext.Provider value={dock}><Dialog defaultOpen>
      <DialogContent><DialogTitle>Draft editor</DialogTitle><DialogDescription>Retained draft</DialogDescription><input aria-label="Draft" defaultValue="Keep me" /></DialogContent>
    </Dialog></PopupDockContext.Provider>);
    const popup = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(popup.style.resize).toBe('both');
    expect(popup.style.overflow).toBe('auto');
    expect(document.body.style.pointerEvents).not.toBe('none');
    const minimize = popup.querySelector<HTMLButtonElement>('[aria-label="Minimize window"]')!;
    expect(minimize.className).toContain('text-yellow-600');
    const close = [...popup.querySelectorAll('button')].find(button => button.textContent === 'Close')!;
    expect(close.className).toContain('text-red-600');
    const resize = popup.querySelector<HTMLButtonElement>('[aria-label="Resize window"]')!;
    expect(document.getElementById(resize.getAttribute('aria-describedby')!)?.textContent).toContain('arrow keys');
    popup.style.width = '400px'; popup.style.height = '300px';
    await act(async () => resize.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(popup.style.width).toBe('432px');
    await act(async () => resize.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    expect(popup.style.height).toBe('332px');
    await act(async () => minimize.click());
    expect(document.body.style.overflow).toBe('scroll');
    expect(popup.className).toContain('data-[state=closed]:hidden');
    expect(popup.querySelector<HTMLInputElement>('input')?.value).toBe('Keep me');
    await act(async () => item!.resume());
    expect(document.body.style.overflow).toBe('hidden');
    expect(popup.querySelector<HTMLInputElement>('input')?.value).toBe('Keep me');
    await act(async () => close.click());
    expect(document.body.style.overflow).toBe('scroll');
  });
  it('counts non-modal popovers alongside dialogs and cleans up on unmount', async () => {
    const windows = (dialogOpen: boolean, popoverOpen: boolean) => <>
      <Dialog open={dialogOpen} modal={false}><DialogContent><DialogTitle>Window</DialogTitle><DialogDescription>Details</DialogDescription></DialogContent></Dialog>
      <Popover open={popoverOpen}><PopoverContent>Popover details</PopoverContent></Popover>
    </>;
    await render(windows(true, true));
    await render(windows(false, true));
    expect(document.body.style.overflow).toBe('hidden');
    await render(null);
    expect(document.body.style.overflow).toBe('scroll');
  });
  it('provides bounded scrollable resizing and red dismissal in shared sheets and alerts', async () => {
    await render(<>
      <Sheet defaultOpen><SheetContent><SheetTitle>Side window</SheetTitle><SheetDescription>Details</SheetDescription></SheetContent></Sheet>
      <AlertDialog defaultOpen><AlertDialogContent><AlertDialogTitle>Confirm</AlertDialogTitle><AlertDialogDescription>Check the change</AlertDialogDescription><AlertDialogCancel>Cancel</AlertDialogCancel></AlertDialogContent></AlertDialog>
    </>);
    const windows = [...document.querySelectorAll<HTMLElement>('[data-popup-window]')];
    expect(windows).toHaveLength(2);
    windows.forEach(window => {
      expect(window.style.resize).toBe('both');
      expect(window.style.overflow).toBe('auto');
      expect(window.style.maxWidth).toBe('calc(100vw - 2rem)');
      expect(window.querySelector('[aria-label="Resize window"]')).toBeTruthy();
      expect([...window.querySelectorAll('button')].some(button => button.className.includes('text-red-600'))).toBe(true);
    });
    await render(null);
    expect(document.body.style.pointerEvents).not.toBe('none');
  });
});
