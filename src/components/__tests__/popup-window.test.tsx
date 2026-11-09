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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';

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
  it('uses a mobile dialog with keyboard viewport sizing and no desktop resize or minimize tools', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
    const viewport = new EventTarget() as EventTarget & { height: number; offsetTop: number };
    viewport.height = 844; viewport.offsetTop = 0;
    const original = window.visualViewport;
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    try {
      const register = vi.fn();
      await render(<PopupDockContext.Provider value={{ register, unregister: vi.fn(), activate: vi.fn() }}><Dialog defaultOpen><DialogContent><DialogTitle>Mobile form</DialogTitle><DialogDescription>Fits the phone</DialogDescription><input aria-label="Entry" /></DialogContent></Dialog></PopupDockContext.Provider>);
      const popup = document.querySelector<HTMLElement>('[data-popup-layout="dialog"]')!;
      expect(popup.style.getPropertyValue('--popup-viewport-height')).toBe('844px');
      expect(document.querySelector('[aria-label="Resize window"]')).toBeNull();
      expect(document.querySelector('[aria-label="Minimize window"]')).toBeNull();
      expect(register).not.toHaveBeenCalled();
      viewport.height = 420; viewport.offsetTop = 30;
      await act(async () => viewport.dispatchEvent(new Event('resize')));
      expect(popup.style.getPropertyValue('--popup-viewport-height')).toBe('420px');
      expect(popup.style.getPropertyValue('--popup-viewport-top')).toBe('30px');
    } finally { Object.defineProperty(window, 'visualViewport', { configurable: true, value: original }); }
  });
  it.each(['top-left', 'top-right', 'bottom-left', 'bottom-right'])('resizes from the %s corner and preserves the opposite corner', async corner => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (!this.hasAttribute('data-popup-window')) return new DOMRect();
      return new DOMRect(parseFloat(this.style.left) || 100, parseFloat(this.style.top) || 120, parseFloat(this.style.width) || 400, parseFloat(this.style.height) || 300);
    });
    await render(<Dialog defaultOpen modal={false}><DialogContent><DialogTitle>Corner window</DialogTitle><DialogDescription>Resize practice</DialogDescription></DialogContent></Dialog>);
    const handles = document.querySelectorAll('.portal-popup-corner');
    expect(handles).toHaveLength(4);
    const handle = document.querySelector<HTMLButtonElement>(`[aria-label="Resize window from ${corner} corner"]`)!;
    handle.setPointerCapture = vi.fn(); handle.hasPointerCapture = () => true; handle.releasePointerCapture = vi.fn();
    await act(async () => {
      handle.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 120 }));
      handle.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 140, clientY: 150 }));
      handle.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    });
    const popup = document.querySelector<HTMLElement>('[data-popup-window]')!;
    expect(popup.style.width).toBe(corner.endsWith('left') ? '360px' : '440px');
    expect(popup.style.height).toBe(corner.startsWith('top') ? '270px' : '330px');
    expect(popup.style.left).toBe(corner.endsWith('left') ? '140px' : '100px');
    expect(popup.style.top).toBe(corner.startsWith('top') ? '150px' : '120px');
    expect(popup.style.position).toBe('fixed');
    await render(null);
    expect(document.querySelectorAll('.portal-popup-corner')).toHaveLength(0);
  });
  it('restores original scrolling only after the last visible window closes, including StrictMode cleanup', async () => {
    const windows = (first: boolean, second: boolean) => <StrictMode><Lock visible={first} /><Lock visible={second} /></StrictMode>;
    await render(windows(true, true));
    expect(document.body.style.overflow).toBe('clip');
    expect(document.documentElement.style.overflow).toBe('hidden');
    await render(windows(false, true));
    expect(document.body.style.overflow).toBe('clip');
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
    expect(document.body.style.overflow).toBe('clip');
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
    expect(popup.classList.contains('portal-popup')).toBe(true);
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
    expect(document.body.style.overflow).toBe('clip');
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
    expect(document.body.style.overflow).toBe('clip');
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
      expect(window.classList.contains('portal-popup')).toBe(true);
      expect(window.style.resize).toBe('both');
      expect(window.style.overflow).toBe('auto');
      expect(window.style.maxWidth).toBe('calc(100vw - 2rem)');
      expect(window.querySelector('[aria-label="Resize window"]')).toBeTruthy();
      expect([...window.querySelectorAll('button')].some(button => button.className.includes('text-red-600'))).toBe(true);
    });
    document.querySelectorAll('.portal-popup-overlay').forEach(overlay => {
      expect(overlay.classList.contains('portal-popup')).toBe(false);
    });
    await render(null);
    expect(document.body.style.pointerEvents).not.toBe('none');
  });
  it('uses the shared menu surface without changing item actions', async () => {
    const select = vi.fn();
    await render(<DropdownMenu defaultOpen modal={false}>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent><DropdownMenuItem onSelect={select}>Review candidate</DropdownMenuItem></DropdownMenuContent>
    </DropdownMenu>);
    expect(document.querySelector('[role="menu"]')?.classList.contains('portal-menu')).toBe(true);
    await act(async () => document.querySelector<HTMLElement>('[role="menuitem"]')!.click());
    expect(select).toHaveBeenCalledOnce();
  });
});
