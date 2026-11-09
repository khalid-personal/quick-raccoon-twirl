import { expect, it } from 'vitest';
import { practiceRecordLabel } from '../practice-record-label';
it('uses stable fictional employers and references without modifying live records', () => {
  const source = 'DEMO Employer 17 · DEMO Sponsor 17 · DEMO-ELMIS-17';
  const label = practiceRecordLabel(source, true);
  expect(label).not.toContain('DEMO');
  expect(label).toContain('FX-ELMIS-17');
  expect(practiceRecordLabel(source, true)).toBe(label);
  expect(practiceRecordLabel(source, false)).toBe(source);
  expect(practiceRecordLabel(undefined, true)).toBeUndefined();
});
it('keeps practice evidence and official-clearance disclaimers explicit', () => {
  const text = practiceRecordLabel('DEMO ONLY: simulated clearance, not official. Pretend passport details differ.', true);
  expect(text).toContain('Practice: simulated clearance, not official');
  expect(text).toContain('fictional passport details differ');
});
