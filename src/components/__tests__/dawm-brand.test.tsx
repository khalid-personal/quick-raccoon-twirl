// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import DawmBrand from '../DawmBrand';
import favicon from '../../../public/dawm-icon.svg?raw';

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('DAWM brand palette', () => {
  it('uses matching teal, ivory and lime marks in every appearance and the browser icon', async () => {
    await act(async () => root.render(<>
      <DawmBrand />
      <DawmBrand appearance="dark" compact />
      <DawmBrand appearance="dark" compact iconOnly />
    </>));
    const marks = [...container.querySelectorAll<SVGElement>('[aria-label="DAWM logo"]')];
    const icon = new DOMParser().parseFromString(favicon, 'image/svg+xml').documentElement;
    expect(marks).toHaveLength(3);
    for (const mark of [...marks, icon]) {
      expect([...mark.querySelectorAll('stop')].map(stop => stop.getAttribute('stop-color'))).toEqual(['#328078', '#12282A']);
      expect(mark.querySelector('path')?.getAttribute('stroke')).toBe('#F4F4ED');
      expect(mark.querySelector('polyline')?.getAttribute('stroke')).toBe('#C8F575');
      expect(mark.querySelector('circle[r="6"]')?.getAttribute('fill')).toBe('#C8F575');
      expect(mark.getAttribute('viewBox')).toBe('0 0 160 160');
    }
    expect(new Set(marks.map(mark => mark.querySelector('linearGradient')?.id)).size).toBe(3);
    expect(container.querySelectorAll('svg')).toHaveLength(3);
    expect(container.textContent?.match(/DAWM/g)).toHaveLength(2);
  });

  it('preserves the Ethiopian flag rather than recoloring national symbols', async () => {
    await act(async () => root.render(<DawmBrand showOrigin />));
    const flag = container.querySelector('[aria-label="Flag of Ethiopia"]');
    expect([...flag?.querySelectorAll('g > rect') ?? []].map(rect => rect.getAttribute('fill'))).toEqual(['#078930', '#FCDD09', '#DA121D']);
    expect(flag?.querySelector('circle')?.getAttribute('fill')).toBe('#0F47AF');
    expect(container.textContent).toContain('MADE IN ETHIOPIA');
  });
});
