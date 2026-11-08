// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { candidatePackageDocuments, candidatePackageSummary, deploymentPackageHtml, safeDocumentUrl } from '../deployment-package';
import { generateDemoDataset } from '../demo-dataset';
import type { CandidateDetail } from '../types';
import { getDocumentFile } from '../document-files';
vi.mock('../document-files', async original => ({ ...await original<typeof import('../document-files')>(), getDocumentFile: vi.fn() }));
const demo = generateDemoDataset(Date.parse('2026-11-07'));
const candidate: CandidateDetail = { ...demo.candidates[0], first_name: '<script>PRIVATE</script>', stages: demo.stages.filter(stage => stage.candidate_id === demo.candidates[0].id).map(stage => ({ ...stage, notes: 'SECRET-STAFF-NOTE' })), documents: [], medical_results: [], chat_messages: [] };
beforeEach(() => { vi.mocked(getDocumentFile).mockReset(); });
describe('candidate deployment package', () => {
  it('exports only safe fields, escapes content, and explicitly lists missing originals', () => {
    const html = deploymentPackageHtml(candidate, [{ id: 'missing', title: '<img src=x onerror=alert(1)>', stage: 'Registration', updatedAt: '', filename: 'missing.pdf', local: false }]);
    expect(html).not.toContain('SECRET-STAFF-NOTE');
    expect(html).not.toContain('<script>PRIVATE</script>');
    expect(html).toContain('&lt;script&gt;PRIVATE&lt;/script&gt;');
    expect(html).toContain('Missing original file');
    expect(html).toContain("default-src 'none'");
    expect(candidatePackageSummary(candidate).stages).toHaveLength(4);
  });
  it('rejects unsafe/placeholder file URLs and never treats simulated QR as official', () => {
    for (const url of ['javascript:alert(1)', '/placeholder.svg', 'data:text/html;base64,YQ==', 'http://example.test/passport.pdf', 'https://user:password@example.test/passport', 'generated']) expect(safeDocumentUrl(url)).toBeUndefined();
    expect(safeDocumentUrl('data:application/pdf;base64,YQ==')).toBe('data:application/pdf;base64,YQ==');
    expect(candidatePackageSummary({ ...candidate, clearance: { labour_ministry: { status: 'cleared', simulated: true } } }).ministry).toContain('not official');
  });
  it('includes actual locally saved bytes and reports missing legacy files; ignores other candidates documents', async () => {
    vi.mocked(getDocumentFile).mockImplementation(async id => id === 'real' ? new Blob(['PDF-FILE'], { type: 'application/pdf' }) : undefined);
    const doc = { id: 'real', candidate_id: candidate.id, file_name: 'contract.pdf', file_type: 'application/pdf', storage_key: 'private', uploaded_at: '2026-11-07', stage_id: 4 };
    const documents = await candidatePackageDocuments({ ...candidate, documents: [doc, { ...doc, id: 'missing', public_url: '/placeholder.svg' }, { ...doc, id: 'other', candidate_id: 'other' }] });
    expect(documents.find(item => item.id === 'real')).toMatchObject({ local: true, stage: 'Deployment', url: 'data:application/pdf;base64,UERGLUZJTEU=' });
    expect(documents.find(item => item.id === 'missing')?.url).toBeUndefined();
    expect(documents.some(item => item.id === 'other')).toBe(false);
    expect(deploymentPackageHtml(candidate, documents)).toContain('download="contract.pdf"');
  });
  it('surfaces storage failures rather than pretending files exist', async () => {
    vi.mocked(getDocumentFile).mockRejectedValue(new Error('Storage blocked'));
    await expect(candidatePackageDocuments({ ...candidate, documents: [{ id: 'real', candidate_id: candidate.id, file_name: 'x.pdf', file_type: 'application/pdf', storage_key: 'x', uploaded_at: '' }] })).rejects.toMatchObject({ message: 'Storage blocked' });
  });
  it('does not expose unsent contract files or future employer contacts in the candidate package', async () => {
    const draft: CandidateDetail = { ...candidate, work_contract_record: { status: 'not-sent', url: 'https://example.test/draft.pdf' }, employer: { company: 'Prospective employer', contact_name: 'Private contact', phone: 'Private phone' } };
    expect(candidatePackageSummary(draft).employer).not.toContain('Private contact');
    expect((await candidatePackageDocuments(draft)).find(doc => doc.id === 'contract')?.url).toBeUndefined();
    expect(candidatePackageSummary({ ...draft, work_contract_record: { status: 'received' } }).employer).toContain('Private contact');
  });
  it('excludes linked medical originals and bank statements without reading their bytes', async () => {
    const doc = { id: 'medical', candidate_id: candidate.id, file_name: 'exam.pdf', file_type: 'application/pdf', storage_key: 'private', uploaded_at: '' };
    const result = await candidatePackageDocuments({ ...candidate, documents: [doc, { ...doc, id: 'bank', file_name: 'Bank-statement.pdf' }], medical_results: [{ id: 'result', candidate_id: candidate.id, exam_type: 'Private exam', status: 'Pending', document_id: 'medical' }] });
    expect(result.some(item => item.id === 'medical' || item.id === 'bank')).toBe(false);
    expect(getDocumentFile).not.toHaveBeenCalled();
  });
  it('rejects unsafe links even when passed directly to the HTML renderer', () => {
    const html = deploymentPackageHtml(candidate, [{ id: 'unsafe', title: 'Original', stage: 'General', filename: 'original', local: false, updatedAt: '', url: 'javascript:alert(1)' }]);
    expect(html).not.toContain('javascript:');
    expect(html).toContain('Missing original file');
  });
});
