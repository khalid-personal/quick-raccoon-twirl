import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';

interface PageMemory { scope: string; values: Map<string, unknown>; positions: Map<string, number>; previousPath?: string; path?: string; }
const MemoryContext = createContext<PageMemory | null>(null);
export function PageMemoryProvider({ children }: { children: ReactNode }) {
  const { user, userRole, viewAs, isDemo } = useAuth();
  const location = useLocation();
  const scope = `${isDemo}:${user?.id ?? 'guest'}:${userRole}:${viewAs?.userId ?? ''}:${viewAs?.trackingCode ?? ''}:${viewAs?.foreignAgencyId ?? ''}:${viewAs?.localAgencyId ?? ''}`;
  const memory = useMemo<PageMemory>(() => ({ scope, values: new Map(), positions: new Map() }), [scope]);
  memory.path = location.pathname;
  return <MemoryContext.Provider key={scope} value={memory}><PageScrollMemory />{children}</MemoryContext.Provider>;
}
export function usePageMemory<T>(name: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const memory = useContext(MemoryContext);
  const key = `${memory?.path ?? ''}:${name}`;
  const [value, setValue] = useState<T>(() => memory?.values.has(key) ? memory.values.get(key) as T : initial);
  const update = useCallback<Dispatch<SetStateAction<T>>>(next => setValue(previous => {
    const resolved = typeof next === 'function' ? (next as (value: T) => T)(previous) : next;
    memory?.values.set(key, resolved);
    return resolved;
  }), [memory, key]);
  return [value, update];
}
function PageScrollMemory() {
  const memory = useContext(MemoryContext);
  const location = useLocation();
  const path = location.pathname + location.search + location.hash;
  const last = useRef(path);
  useLayoutEffect(() => {
    if (!memory) return;
    if (last.current.split('?')[0] !== location.pathname) memory.previousPath = last.current;
    last.current = path;
    const target = memory.positions.get(path) ?? 0;
    let active = true;
    let restoring = target > 0 || !!location.hash;
    const restore = () => {
      if (!active || !restoring) return;
      if (location.hash) {
        const anchor = document.getElementById(location.hash.slice(1));
        if (anchor) { anchor.scrollIntoView(); restoring = false; }
        return;
      }
      window.scrollTo(0, Math.min(target, Math.max(0, document.documentElement.scrollHeight - window.innerHeight)));
      if (document.documentElement.scrollHeight - window.innerHeight >= target) restoring = false;
    };
    window.scrollTo(0, 0);
    restore();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(restore);
    observer?.observe(document.body);
    const cancel = () => { restoring = false; };
    const save = () => { if (!restoring) memory.positions.set(path, window.scrollY); };
    window.addEventListener('scroll', save, { passive: true });
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchstart', cancel, { passive: true });
    const timer = window.setTimeout(cancel, 5000);
    return () => {
      active = false; observer?.disconnect(); window.clearTimeout(timer);
      window.removeEventListener('scroll', save); window.removeEventListener('wheel', cancel); window.removeEventListener('touchstart', cancel);
    };
  }, [path, memory, location.pathname, location.hash]);
  return null;
}
export function useReturnToPrevious(fallback: string) {
  const memory = useContext(MemoryContext);
  const navigate = useNavigate();
  return () => {
    const previous = memory?.previousPath;
    if (previous && /^(\/admin|\/agency|\/local-agency|\/auditor|\/viewer)(\/|\?|$)/.test(previous)) navigate(-1);
    else navigate(fallback);
  };
}
