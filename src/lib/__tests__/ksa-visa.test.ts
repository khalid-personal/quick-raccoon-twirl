// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import QRCode from 'qrcode';
import { getCandidates, initializeDataStore, saveCandidates } from '../data-store';
import { checkClearanceStep, clearCandidate, getVisaServiceInfo, isCleared, printClearanceCertificate, simulateMinistryQrIssuance, verifyVisa } from '../ksa-visa';
import type { Candidate } from '../types';

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,c2ltdWxhdGlvbg==') } }));

const candidate = (patch: Partial<Candidate> = {}): Candidate => ({
  id: 'candidate-1',
  first_name: 'Aster',
  last_name: 'QA',
  dob: '1995-01-01',
  passport_number: 'ET123456',
  tracking_code: 'TRK-ET-1234',
  country_of_origin: 'Ethiopia',
  marital_status: 'Single',
  email: 'aster@example.test',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  payment_status: 'unpaid',
  visa: { visa_number: 'VISA-123', status: 'validated', expiry_date: '2027-01-01', mode: 'sandbox', checked_at: '2026-01-01T00:00:00.000Z' },
  clearance: {
    enjaz: { status: 'completed', reference: 'ENJ-1', updated_at: '2026-01-01T00:00:00.000Z' },
    tasheer: { status: 'completed', reference: 'TSH-1', updated_at: '2026-01-01T00:00:00.000Z' },
    certificate_no: 'OLD-LOCAL-CERTIFICATE',
  },
  ...patch,
});

describe('Labour Ministry clearance certificate', () => {
  it('does not treat local readiness or a legacy local number as official clearance', () => {
    expect(isCleared(candidate({ clearance: { ...candidate().clearance, local_ready_at: '2026-01-02T00:00:00.000Z' } }))).toBe(false);
  });

  it('requires a ministry-cleared status, issuer number, and secure QR image', () => {
    const cleared = candidate({ clearance: {
      ...candidate().clearance,
      labour_ministry: {
        status: 'cleared',
        mode: 'live',
        certificate_no: 'MIN-2026-1',
        qr_image_url: 'https://ministry.example.test/qr/MIN-2026-1.png',
        issued_at: '2026-01-03T00:00:00.000Z',
      },
    } });
    const ministryResult = cleared.clearance?.labour_ministry;
    if (!ministryResult) throw new Error('Expected ministry clearance fixture.');
    expect(isCleared(cleared)).toBe(true);
    expect(isCleared(candidate({ clearance: {
      ...cleared.clearance,
      labour_ministry: { ...ministryResult, qr_image_url: 'http://insecure.example.test/qr.png' },
    } }))).toBe(false);
  });

  it('refuses to print until an official QR certificate exists', () => {
    const open = vi.spyOn(window, 'open');
    expect(() => printClearanceCertificate(candidate(), 'QA agency')).toThrow(/Labour Ministry/);
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('issues a demo-only scannable QR without unlocking the official certificate', async () => {
    localStorage.clear();
    sessionStorage.setItem('dawm_demo_session', '1');
    initializeDataStore();
    const actor = { id: 'demo-user', email: 'demo@example.test' };
    saveCandidates([candidate({ clearance: {} })]);
    expect(await getVisaServiceInfo()).toMatchObject({ providerName: 'DAWM demo simulation', modes: { visa: 'sandbox', enjaz: 'sandbox', tasheer: 'sandbox' } });
    await verifyVisa(getCandidates()[0], 'DEMO-VISA-123', actor);
    await checkClearanceStep(getCandidates()[0], 'enjaz', 'DEMO-ENJ-123', actor);
    await checkClearanceStep(getCandidates()[0], 'tasheer', 'DEMO-TSH-123', actor);
    await clearCandidate(getCandidates()[0], actor);

    const result = await simulateMinistryQrIssuance(getCandidates()[0], actor);

    expect(result).toMatchObject({ status: 'cleared', mode: 'sandbox', simulated: true, certificate_no: 'DEMO-ONLY-TRK-ET-1234' });
    expect(result.qr_image_url).toMatch(/^data:image\/png;base64,/);
    expect(vi.mocked(QRCode.toDataURL)).toHaveBeenCalledWith(expect.stringContaining('NOT AN OFFICIAL CERTIFICATE'), expect.any(Object));
    expect(isCleared(getCandidates()[0])).toBe(false);
    expect(() => printClearanceCertificate(getCandidates()[0], 'QA agency')).toThrow(/Labour Ministry/);
  });

  it('refuses ministry QR simulation outside the demo sandbox', async () => {
    sessionStorage.clear();
    await expect(simulateMinistryQrIssuance(candidate(), { id: 'user', email: 'user@example.test' })).rejects.toThrow(/demo sandbox/);
  });
});
