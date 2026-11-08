import { describe, expect, it } from 'vitest';
import { nextTrackingCode } from '../tracking-code';

describe('tracking code generation', () => {
  it('generates the first code for the selected country', () => {
    expect(nextTrackingCode('Ethiopia', [])).toBe('TRK-ET-0001');
    expect(nextTrackingCode('United States', [])).toBe('TRK-US-0001');
  });
  it('increments the highest code and ignores other country and legacy formats', () => {
    expect(nextTrackingCode('Ethiopia', [
      { tracking_code: 'trk-et-0009' }, { tracking_code: 'TRK-ET-0002' },
      { tracking_code: 'TRK-US-1000' }, { tracking_code: 'TRK-D0001' },
    ])).toBe('TRK-ET-0010');
  });
  it('does not wrap at 9999 and rejects missing or unknown countries', () => {
    expect(nextTrackingCode('ET', [{ tracking_code: 'TRK-ET-9999' }])).toBe('TRK-ET-10000');
    expect(() => nextTrackingCode('', [])).toThrow('Select a recognized country');
    expect(() => nextTrackingCode('Other', [])).toThrow('Select a recognized country');
  });
});
