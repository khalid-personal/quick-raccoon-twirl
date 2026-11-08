// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { summarizeCandidateListStatuses } from '../candidate-list-status';
import type { CandidateSummary } from '../types';

const candidate = (overrides: Partial<CandidateSummary> = {}): CandidateSummary => ({
  id: 'candidate-1',
  first_name: 'Test',
  last_name: 'Candidate',
  dob: '1995-01-01',
  passport_number: 'P1',
  tracking_code: 'TRK-1',
  country_of_origin: 'Ethiopia',
  email: 'candidate@example.test',
  marital_status: 'Single',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  payment_status: 'unpaid',
  progress_percent: 0,
  overall_status: 'Pending',
  is_medical_paid: false,
  paid_stage_ids: [],
  ...overrides,
});

describe('candidate list status summary', () => {
  it('counts registration-started candidates as in progress and distinguishes ministry QR waiting', () => {
    const counts = summarizeCandidateListStatuses([
      candidate(),
      candidate({ id: 'qr-pending', clearance: { local_ready_at: '2026-02-01T00:00:00.000Z' } }),
      candidate({ id: 'completed', overall_status: 'Completed', progress_percent: 100 }),
      candidate({ id: 'failed', overall_status: 'Blocked' }),
      candidate({ id: 'qr-rejected', clearance: { labour_ministry: { status: 'rejected' } } }),
      candidate({ id: 'ministry-error', clearance: { labour_ministry: { status: 'error' } } }),
    ]);

    expect(counts).toEqual({ inProgress: 1, pendingQr: 1, completed: 1, failed: 3, total: 6 });
  });

  it('does not let official ministry clearance bypass unfinished journey stages', () => {
    const counts = summarizeCandidateListStatuses([candidate({
      clearance: {
        enjaz: { status: 'completed', updated_at: '2026-01-01T00:00:00.000Z' },
        tasheer: { status: 'completed', updated_at: '2026-01-01T00:00:00.000Z' },
        labour_ministry: { status: 'cleared', certificate_no: 'CERT-1', qr_image_url: 'https://example.test/qr.png' },
      },
      visa: { visa_number: 'V1', status: 'validated', checked_at: '2026-01-01T00:00:00.000Z', mode: 'live' },
    })]);
    expect(counts).toEqual({ inProgress: 1, pendingQr: 0, completed: 0, failed: 0, total: 1 });
  });
});
