// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi } from 'vitest';
import IntegrityScore from '../IntegrityScore';
describe('visual integrity score', () => {
  it('shows the score ring, priority warnings even with a high score and actionable review', async () => {
    const container = document.createElement('div'); const root = createRoot(container);
    const review = vi.fn();
    await act(async () => root.render(<IntegrityScore score={94} candidateCount={435} counts={{ critical: 1, high: 2, medium: 0, low: 1 }} onReview={review} />));
    expect(container.textContent).toContain('94');
    expect(container.textContent).toContain('Higher is better');
    expect(container.textContent).toContain('3 critical/high findings still need attention');
    expect(container.querySelector('svg circle[stroke-dashoffset]')).not.toBeNull();
    await act(async () => container.querySelector('button')!.click());
    expect(review).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });
});
