import { describe, expect, it } from 'vitest';
import { detectDocumentStage, detectDocumentStageFromText } from '../document-stage-detection';

describe('document stage detection', () => {
  it('matches common document names to their workflow stage', () => {
    expect(detectDocumentStage('candidate_passport.pdf')).toBe(1);
    expect(detectDocumentStage('CoC-training-certificate.pdf')).toBe(3);
    expect(detectDocumentStage('medical_report.pdf')).toBe(2);
    expect(detectDocumentStage('work-contract-visa.pdf')).toBe(4);
  });

  it('returns no automatic match when the file name is unknown or ambiguous', () => {
    expect(detectDocumentStage('scan-001.pdf')).toBeUndefined();
    expect(detectDocumentStage('passport-medical.pdf')).toBeUndefined();
  });

  it('classifies a document from OCR text when the filename is generic', () => {
    expect(detectDocumentStageFromText('MEDICAL EXAMINATION REPORT / LAB RESULTS')).toBe(2);
    expect(detectDocumentStageFromText('COC CERTIFICATE OF COMPETENCY')).toBe(3);
    expect(detectDocumentStageFromText('Personal data verified')).toBeUndefined();
  });
});
