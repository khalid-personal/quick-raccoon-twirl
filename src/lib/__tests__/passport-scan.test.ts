import { describe, expect, it } from 'vitest';
import { MAX_PASSPORT_SCAN_BYTES, validatePassportScanFile } from '../passport-scan';

describe('passport scan file validation', () => {
  it('accepts a PDF at the 15 MB limit', () => {
    const file = new File([new Uint8Array(MAX_PASSPORT_SCAN_BYTES)], 'passport.pdf', { type: 'application/pdf' });
    expect(() => validatePassportScanFile(file)).not.toThrow();
  });

  it('rejects PDFs larger than 15 MB and unsupported files', () => {
    const oversized = new File([new Uint8Array(MAX_PASSPORT_SCAN_BYTES + 1)], 'passport.pdf', { type: 'application/pdf' });
    const unsupported = new File(['data'], 'passport.txt', { type: 'text/plain' });

    expect(() => validatePassportScanFile(oversized)).toThrow('Passport files must be 15 MB or smaller.');
    expect(() => validatePassportScanFile(unsupported)).toThrow('Choose a passport image or PDF file.');
  });
});
