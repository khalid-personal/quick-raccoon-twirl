import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Minus, X } from "lucide-react";
import { usePopupDock } from "@/components/popup-dock-context";

import { cn } from "@/lib/utils";

const WindowContext = React.createContext<{
  managed: boolean; requestedOpen: boolean; minimize: () => void; setTitle: (title: string) => void;
} | null>(null);

function Dialog({ open: controlledOpen, defaultOpen = false, onOpenChange, modal = true, workspaceManaged = true, activationKey, ...props }:
  React.ComponentProps<typeof DialogPrimitive.Root> & { workspaceManaged?: boolean; activationKey?: number }) {
  const dock = usePopupDock();
  const id = React.useId();
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const [minimized, setMinimized] = React.useState(false);
  const [title, setTitle] = React.useState('Window');
  const requestedOpen = controlledOpen ?? internalOpen;
  const managed = !!dock && workspaceManaged;
  const handler = React.useRef(onOpenChange);
  handler.current = onOpenChange;
  const changeOpen = React.useCallback((value: boolean) => {
    setInternalOpen(value); setMinimized(false); handler.current?.(value);
  }, []);
  const resume = React.useCallback(() => { dock?.activate(id); setMinimized(false); }, [dock, id]);
  const minimize = React.useCallback(() => setMinimized(true), []);
  const close = React.useCallback(() => changeOpen(false), [changeOpen]);
  React.useEffect(() => {
    if (!requestedOpen) setMinimized(false);
  }, [requestedOpen]);
  React.useEffect(() => {
    if (!managed || !requestedOpen || !dock) return;
    dock.register({ id, title, minimized, minimize, resume, close });
    return () => dock.unregister(id);
  }, [managed, requestedOpen, dock, id, title, minimized, minimize, resume, close]);
  React.useEffect(() => {
    if (managed && requestedOpen) { dock?.activate(id); setMinimized(false); }
  }, [managed, requestedOpen, activationKey, dock, id]);
  return <WindowContext.Provider value={{ managed, requestedOpen, minimize, setTitle }}>
    <DialogPrimitive.Root {...props} open={requestedOpen && !minimized} onOpenChange={changeOpen} modal={managed ? false : modal} />
  </WindowContext.Provider>;
}

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { keepMounted?: boolean }
>(({ className, children, keepMounted, onInteractOutside, ...props }, ref) => {
  const window = React.useContext(WindowContext);
  const retain = keepMounted || window?.managed && window.requestedOpen;
  return <DialogPortal forceMount={retain ? true : undefined}>
    <DialogOverlay className={retain ? 'data-[state=closed]:hidden' : undefined} />
    <DialogPrimitive.Content
      ref={ref}
      forceMount={retain ? true : undefined}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className,
        retain && 'data-[state=closed]:hidden',
        window?.managed && 'z-[55] !animate-none max-h-[calc(100dvh-7rem)] overflow-y-auto',
      )}
      {...props}
      onInteractOutside={event => { if (window?.managed) event.preventDefault(); onInteractOutside?.(event); }}
    >
      {children}
      {window?.managed && <button type="button" aria-label="Minimize window" title="Minimize without discarding unsaved edits" onClick={window.minimize} className="absolute right-12 top-4 rounded-sm p-0.5 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Minus className="h-4 w-4" /></button>}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>;
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, children, ...props }, ref) => {
  const window = React.useContext(WindowContext);
  const setTitle = window?.setTitle;
  const title = dialogTitleText(children);
  React.useEffect(() => {
    if (setTitle && title) setTitle(title);
  }, [title, setTitle]);
  return (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "pr-12 text-lg font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  >{children}</DialogPrimitive.Title>
);
});
DialogTitle.displayName = DialogPrimitive.Title.displayName;

function dialogTitleText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(dialogTitleText).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return dialogTitleText(node.props.children);
  return '';
}

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
