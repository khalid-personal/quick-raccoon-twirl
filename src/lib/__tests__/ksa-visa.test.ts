// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { buildClearanceCsv, checkClearanceStep, clearCandidate, isCleared, printClearanceCertificate, simulateMinistryQrIssuance, verifyVisa } from '../ksa-visa';
import { generateDemoDataset } from '../demo-dataset';
import { MINISTRY_STAGE_MESSAGE } from '../ministry-candidates';
const candidate = generateDemoDataset(Date.parse('2026-11-07')).candidates[0];
const actor = { id: 'operator', email: 'operator@example.test' };
it('rejects local visa, clearance and QR issuance without any storage writes', async () => {
  const before = { ...localStorage };
  await expect(verifyVisa(candidate, 'V1', actor)).rejects.toThrow(MINISTRY_STAGE_MESSAGE);
  await expect(checkClearanceStep(candidate, 'enjaz', 'E1', actor)).rejects.toThrow(MINISTRY_STAGE_MESSAGE);
  await expect(clearCandidate(candidate, actor)).rejects.toThrow(MINISTRY_STAGE_MESSAGE);
  await expect(simulateMinistryQrIssuance(candidate, actor)).rejects.toThrow(MINISTRY_STAGE_MESSAGE);
  expect({ ...localStorage }).toEqual(before);
});
it('exports only the nine reference columns and protects spreadsheet formula prefixes', () => {
  const csv = buildClearanceCsv([{ ...candidate, tracking_code: '=1+1', visa: { visa_number: '+REFERENCE', status: 'pending', mode: 'live', checked_at: '2026-01-01' } }]);
  expect(csv.split('\n')[0].split(',')).toHaveLength(9);
  expect(csv).toContain('"\'=1+1"');
  expect(csv).toContain('"\'+REFERENCE"');
  expect(csv).not.toContain('qr_image');
  expect(() => printClearanceCertificate(candidate, 'Agency')).toThrow('Certificates are held by the ministry');
});
it('accepts ministry status and certificate references without storing QR image bodies', () => {
  const person = { ...candidate, visa: { visa_number: 'V1', status: 'validated' as const, mode: 'live' as const, checked_at: '2026-01-01' }, clearance: {
    enjaz: { status: 'completed' as const, reference: 'E1', updated_at: '2026-01-01' },
    tasheer: { status: 'completed' as const, reference: 'T1', updated_at: '2026-01-01' },
    labour_ministry: { status: 'cleared' as const, mode: 'live' as const, certificate_no: 'M1' },
  } };
  expect(isCleared(person)).toBe(true);
  expect(isCleared({ ...person, clearance: { ...person.clearance, labour_ministry: { ...person.clearance.labour_ministry, simulated: true } } })).toBe(false);
  const csv = buildClearanceCsv([person]);
  expect(csv).toContain('M1');
  expect(csv).not.toContain(person.passport_number);
  expect(csv).not.toContain(person.first_name);
});
