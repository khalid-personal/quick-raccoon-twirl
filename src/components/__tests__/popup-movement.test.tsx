// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Popover, PopoverContent } from '../ui/popover';
import { PopupResizeControl } from '../ui/popup-window';
import { PopupDockContext, type PopupDockItem } from '../popup-dock-context';

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000);
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (!this.hasAttribute('data-popup-window')) return new DOMRect();
    const px = (value: string, fallback: number) => value.endsWith('px') ? parseFloat(value) : fallback;
    return new DOMRect(px(this.style.left, 100), px(this.style.top, 120), px(this.style.width, 400), px(this.style.height, 300));
  });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)); };
const popup = () => {
  const element = document.querySelector<HTMLElement>('[data-popup-window]')!;
  element.setPointerCapture = vi.fn(); element.hasPointerCapture = () => true; element.releasePointerCapture = vi.fn();
  return element;
};
const pointer = async (target: Element, type: string, x = 100, y = 120) => {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: 7 });
  await act(async () => target.dispatchEvent(event));
};
it.each(['dialog', 'alert', 'sheet', 'custom'])('moves %s windows from headings without discarding contents or breaking resizing', async type => {
  const contents = <><input aria-label="Draft" defaultValue="Retained draft" /><button>Save</button></>;
  const view = type === 'dialog' ? <Dialog defaultOpen modal={false}><DialogContent><DialogHeader><DialogTitle>Moveable editor</DialogTitle><DialogDescription>Details</DialogDescription></DialogHeader>{contents}</DialogContent></Dialog>
    : type === 'alert' ? <AlertDialog defaultOpen><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm change</AlertDialogTitle><AlertDialogDescription>Details</AlertDialogDescription></AlertDialogHeader>{contents}</AlertDialogContent></AlertDialog>
      : type === 'sheet' ? <Sheet defaultOpen><SheetContent><SheetHeader><SheetTitle>Side editor</SheetTitle><SheetDescription>Details</SheetDescription></SheetHeader>{contents}</SheetContent></Sheet>
        : <section data-popup-window="" className="portal-popup"><header>Custom chats</header>{contents}<PopupResizeControl /></section>;
  await render(view);
  const window = popup();
  const header = window.querySelector('.portal-popup-header, header')!;
  await pointer(header, 'pointerdown');
  await pointer(window, 'pointermove', 180, 170);
  expect(window.style.left).toBe('180px');
  expect(window.style.top).toBe('170px');
  expect(window.style.transform).toBe('none');
  expect(window.style.getPropertyValue('--popup-left')).toBe('180px');
  expect(window.style.getPropertyValue('--popup-top')).toBe('170px');
  expect(window.dataset.popupDragging).toBe('true');
  await pointer(window, 'pointerup');
  expect(window.dataset.popupDragging).toBeUndefined();
  expect(window.querySelector<HTMLInputElement>('input')?.value).toBe('Retained draft');
  const resize = window.querySelector('[aria-label="Resize window"]')!;
  await act(async () => resize.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
  expect(window.style.width).toBe('432px');
});
it('supports bounded pointer/keyboard movement, centering and cancellation without intercepting form controls', async () => {
  const action = vi.fn();
  await render(<Dialog defaultOpen modal={false}><DialogContent><DialogHeader><DialogTitle>Editor</DialogTitle><DialogDescription>Details</DialogDescription><button onClick={action}>Header action</button><input aria-label="Search" /></DialogHeader></DialogContent></Dialog>);
  const window = popup(), header = window.querySelector('.portal-popup-header')!;
  const button = window.querySelector<HTMLButtonElement>('.portal-popup-header button')!;
  await pointer(button, 'pointerdown'); await pointer(window, 'pointermove', 999, 999);
  expect(window.dataset.popupMoved).toBeUndefined();
  await act(async () => button.click()); expect(action).toHaveBeenCalledOnce();
  await pointer(header, 'pointerdown'); await pointer(window, 'pointermove', -999, -999);
  expect(window.style.left).toBe('16px'); expect(window.style.top).toBe('16px');
  await pointer(window, 'pointercancel'); await pointer(window, 'pointermove', 999, 999);
  expect(window.style.left).toBe('16px');
  const move = window.querySelector('[aria-label="Move window"]')!;
  expect(move.getAttribute('aria-describedby')).toBeTruthy();
  await act(async () => move.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true })));
  expect(window.style.left).toBe('80px');
  await act(async () => move.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
  expect(window.style.left).toBe('300px'); expect(window.style.top).toBe('250px');
  await pointer(move, 'pointerdown'); await pointer(window, 'pointermove', 9999, 9999); await pointer(window, 'pointerup');
  expect(window.style.left).toBe('584px'); expect(window.style.top).toBe('484px');
});
it('retains moved position and drafts across minimize/resume, but removes desktop positioning when switching to mobile', async () => {
  let item: PopupDockItem | undefined;
  await render(<PopupDockContext.Provider value={{ register: value => { item = value; }, unregister: vi.fn(), activate: vi.fn() }}><Dialog defaultOpen><DialogContent><DialogHeader><DialogTitle>Draft editor</DialogTitle><DialogDescription>Details</DialogDescription></DialogHeader><input defaultValue="Keep" /></DialogContent></Dialog></PopupDockContext.Provider>);
  const window = popup();
  await pointer(window.querySelector('[aria-label="Move window"]')!, 'pointerdown');
  await pointer(window, 'pointermove', 160, 160); await pointer(window, 'pointerup');
  const left = window.style.left;
  await act(async () => item!.minimize()); await act(async () => item!.resume());
  expect(window.style.left).toBe(left); expect(window.querySelector('input')?.value).toBe('Keep');
  vi.spyOn(globalThis.window, 'innerWidth', 'get').mockReturnValue(390);
  await act(async () => globalThis.window.dispatchEvent(new Event('resize')));
  const mobileWindow = popup();
  expect(mobileWindow.querySelector('[aria-label="Move window"]')).toBeNull();
  expect(mobileWindow.dataset.popupMovable).toBeUndefined();
  expect(mobileWindow.style.left).toBe('');
  expect(mobileWindow.style.getPropertyValue('--popup-left')).toBe('');
  expect(mobileWindow.querySelector('[aria-label="Resize window"]')).toBeNull();
});
it('reclamps a moved window after keyboard enlargement near the right viewport edge', async () => {
  await render(<Dialog defaultOpen modal={false}><DialogContent><DialogHeader><DialogTitle>Editor</DialogTitle><DialogDescription>Details</DialogDescription></DialogHeader></DialogContent></Dialog>);
  const element = popup();
  const move = element.querySelector('[aria-label="Move window"]')!;
  await pointer(move, 'pointerdown'); await pointer(element, 'pointermove', 9999, 9999); await pointer(element, 'pointerup');
  const resize = element.querySelector('[aria-label="Resize window"]')!;
  await act(async () => resize.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
  expect(parseFloat(element.style.left) + parseFloat(element.style.width)).toBeLessThanOrEqual(984);
  expect(element.style.getPropertyValue('--popup-left')).toBe(element.style.left);
});
it('keeps contextual popovers anchored without a misleading move control', async () => {
  await render(<Popover defaultOpen><PopoverContent>Anchored evidence</PopoverContent></Popover>);
  expect(popup().querySelector('[aria-label="Move window"]')).toBeNull();
  expect(popup().dataset.popupMovable).toBeUndefined();
});
