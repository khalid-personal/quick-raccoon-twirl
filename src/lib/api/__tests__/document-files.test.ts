// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDocuments, saveCandidates, saveCandidateStages, saveDocuments } from '../../data-store';
import { generateDemoDataset } from '../../demo-dataset';
import { saveDocumentFile, deleteDocumentFile } from '../../document-files';
import { uploadDocument, deleteDocument } from '../document-management';
import { getPublicTrackingData } from '../tracking-queries';
vi.mock('../../document-files', () => ({ saveDocumentFile: vi.fn(), deleteDocumentFile: vi.fn() }));
const candidate = generateDemoDataset(Date.parse('2026-11-07')).candidates[0];
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks();
  vi.mocked(saveDocumentFile).mockResolvedValue(); vi.mocked(deleteDocumentFile).mockResolvedValue();
  saveCandidates([candidate]);
});
describe('document bytes and public tracking boundary', () => {
  it('persists original file before registering its metadata and removes bytes on deletion', async () => {
    const file = new File(['%PDF-1.4'], 'visa.pdf', { type: 'application/pdf' });
    const doc = await uploadDocument(candidate.id, 4, file);
    expect(saveDocumentFile).toHaveBeenCalledWith(doc.id, file);
    expect(doc.public_url).toBeUndefined();
    expect(getDocuments()).toHaveLength(1);
    await deleteDocument(doc.id);
    expect(deleteDocumentFile).toHaveBeenCalledWith(doc.id);
    expect(getDocuments()).toEqual([]);
  });
  it('rejects unsupported, blocked and empty uploads instead of fake success', async () => {
    await expect(uploadDocument(candidate.id, 1, new File(['x'], 'x.html', { type: 'text/html' }))).rejects.toThrow('PDF');
    await expect(uploadDocument(candidate.id, 1, new File([], 'x.pdf', { type: 'application/pdf' }))).rejects.toThrow('nonempty');
    await expect(uploadDocument(candidate.id, 1, new File(['x'], 'x.pdf', { type: 'application/pdf' }), { status: 'blocked', findings: [], scanned_at: '' })).rejects.toThrow('blocked');
    expect(saveDocumentFile).not.toHaveBeenCalled();
  });
  it('does not register metadata when durable file storage fails', async () => {
    vi.mocked(saveDocumentFile).mockRejectedValue(new Error('Storage denied'));
    await expect(uploadDocument(candidate.id, 1, new File(['x'], 'x.pdf', { type: 'application/pdf' }))).rejects.toThrow('Storage denied');
    expect(getDocuments()).toEqual([]);
  });
  it('excludes document links and private stage notes from public tracking responses', async () => {
    saveCandidateStages([{ id: 'stage', candidate_id: candidate.id, stage_id: 1, status: 'In Progress', notes: 'PRIVATE-STAFF-NOTE', updated_at: '2026-11-07' }]);
    saveDocuments([{ id: 'doc', candidate_id: candidate.id, file_name: 'private.pdf', file_type: 'application/pdf', storage_key: 'private', public_url: 'https://example.test/private.pdf', stage_id: 1, uploaded_at: '2026-11-07' }]);
    const result = await getPublicTrackingData(candidate.tracking_code);
    expect(JSON.stringify(result)).not.toContain('PRIVATE-STAFF-NOTE');
    expect(JSON.stringify(result)).not.toContain('private.pdf');
    expect(result?.timeline.every(stage => stage.documents.length === 0)).toBe(true);
  });
});
