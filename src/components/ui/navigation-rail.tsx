import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

export const navigationRail = 'navigation-rail';
export const navigationItem = 'navigation-rail-item';

export const navigationAccent = (color: string) => ({ '--nav-color': color } as CSSProperties);

export function navigationItemClass(active: boolean, className?: string) {
  return cn(navigationItem, active && 'navigation-rail-item-active', className);
}
