// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getCandidates, initializeDataStore } from '../../data-store';
import { createCandidate } from '../candidate-crud';
import { nextTrackingCode } from '../../tracking-code';
import { parsePassportMrz } from '../../passport-mrz';

describe('passport registration persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    initializeDataStore();
  });
  it('persists the generated code, origin and additional scanned passport data', async () => {
    const candidate = getCandidates()[0];
    const scanned = parsePassportMrz('P<USAERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36USA7408122F1204159ZE184226B<<<<<10')!;
    const trackingCode = nextTrackingCode(scanned.country_of_origin!, getCandidates());
    const created = await createCandidate({
      ...candidate, ...scanned,
      first_name: scanned.first_name!, last_name: scanned.last_name!, dob: scanned.dob!,
      passport_number: scanned.passport_number!, gender: scanned.gender!,
      country_of_origin: scanned.country_of_origin!, tracking_code: trackingCode, email: 'new-registration@example.test',
    }, 'test-operator', 'operator@example.test');
    expect(getCandidates().find(item => item.id === created.id)).toMatchObject({
      tracking_code: 'TRK-US-0001', country_of_origin: 'United States',
      passport_nationality: 'United States', passport_issuing_country: 'United States',
      passport_expiry_date: '2012-04-15', passport_document_type: 'P',
    });
  });
  it('rejects an occupied tracking number even if casing or whitespace differs', async () => {
    const candidate = getCandidates()[0];
    await expect(createCandidate({
      ...candidate, tracking_code: ` ${candidate.tracking_code.toLowerCase()} `,
      email: 'new@example.test', passport_number: 'new-passport',
    }, 'test-operator', 'operator@example.test')).rejects.toThrow('already exists');
  });
});
