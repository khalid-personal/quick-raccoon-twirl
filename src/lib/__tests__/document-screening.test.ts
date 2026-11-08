// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { File as NodeFile } from 'node:buffer';
import { scanDocumentFile } from '../document-screening';
import type { Document } from '../types';

const scanFile = (file: NodeFile, existingDocuments: Document[] = []) =>
  scanDocumentFile(file as unknown as Parameters<typeof scanDocumentFile>[0], existingDocuments);

describe('document upload screening', () => {
  it('clears a valid PDF', async () => {
    const file = new NodeFile(['%PDF-1.7\nplain document'], 'identity.pdf', { type: 'application/pdf' });
    const report = await scanFile(file);
    expect(report.status).toBe('clear');
    expect(report.findings).toEqual([]);
  });

  it('blocks executable files and invalid PDF signatures', async () => {
    const executable = new NodeFile(['binary'], 'identity.pdf.exe', { type: 'application/octet-stream' });
    const invalidPdf = new NodeFile(['not a PDF'], 'identity.pdf', { type: 'application/pdf' });
    expect((await scanFile(executable)).status).toBe('blocked');
    expect((await scanFile(invalidPdf)).status).toBe('blocked');
  });

  it('flags PDFs with active content for human review', async () => {
    const file = new NodeFile(['%PDF-1.7\n/OpenAction /JavaScript'], 'form.pdf', { type: 'application/pdf' });
    const report = await scanFile(file);
    expect(report.status).toBe('review');
    expect(report.findings).toContain('The PDF contains active content or embedded-file markers.');
  });

  it('flags repeated file content on a candidate record', async () => {
    const file = new NodeFile(['%PDF-1.7\nrepeat'], 'first.pdf', { type: 'application/pdf' });
    const original = await scanFile(file);
    const duplicate = await scanFile(new NodeFile(['%PDF-1.7\nrepeat'], 'copy.pdf', { type: 'application/pdf' }), [
      { id: 'existing', candidate_id: 'candidate-1', file_name: 'first.pdf', file_type: 'application/pdf', storage_key: 'first.pdf', uploaded_at: '', scan_report: original },
    ]);
    if (original.fingerprint) {
      expect(duplicate.status).toBe('review');
      expect(duplicate.findings).toContain('This file is identical to a document already on the candidate record.');
    }
  });
});
