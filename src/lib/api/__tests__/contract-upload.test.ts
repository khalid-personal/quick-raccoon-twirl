// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadDocument, deleteDocument, type ContractUploadReview } from '../document-management';
import { getCandidates, getDocuments, saveCandidates } from '../../data-store';
import { generateDemoDataset } from '../../demo-dataset';
import { saveDocumentFile } from '../../document-files';
import { minimumPerCandidate, contractCountryOf } from '../../currency';
import { departureBlockers } from '../../departure-readiness';

vi.mock('../../document-files', () => ({ saveDocumentFile: vi.fn(), deleteDocumentFile: vi.fn() }));
const candidate = { ...generateDemoDataset(Date.parse('2026-11-08')).candidates[0], employer: undefined, external_status: { work_contract: false, visa: false }, local_agency_id: 'local', foreign_agency_id: 'foreign' };
const file = () => new File(['%PDF-1.4 synthetic'], 'employment-contract.pdf', { type: 'application/pdf' });
const report = { status: 'clear' as const, findings: [], scanned_at: '2026-11-08' };
const review = (): ContractUploadReview => ({
  fields: { employer: 'Fictional Household', employer_contact_name: 'Contact', employer_phone: '+966500000001', employer_email: 'contact@example.test', destination_country: 'Saudi Arabia', destination_city: 'Riyadh', start_date: '2026-11-01', expiry_date: '2028-11-01' },
  scannedPages: 2, confirmed: true, actor: { id: 'local-user', email: 'local@example.test', role: 'local-agency', localAgencyId: 'local' },
});
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks(); vi.mocked(saveDocumentFile).mockResolvedValue(); saveCandidates([candidate]); });
describe('reviewed contract uploads', () => {
  it('persists original, reviewed metadata and employer contacts without changing ministry identity, stages or visa clearance', async () => {
    const before = getCandidates()[0];
    const blockers = departureBlockers(before);
    const doc = await uploadDocument(candidate.id, 4, file(), report, review());
    const updated = getCandidates()[0];
    expect(saveDocumentFile).toHaveBeenCalledWith(doc.id, expect.any(File));
    expect(doc).toMatchObject({ doc_kind: 'work_contract', extracted: review().fields, extraction_review: { reviewed_by: 'local@example.test', scanned_pages: 2 } });
    expect(updated.employer).toMatchObject({ company: 'Fictional Household', phone: '+966500000001', email: 'contact@example.test', source_document_id: doc.id });
    expect(updated.work_contract_record).toMatchObject({ status: 'received', document_id: doc.id });
    expect(updated.external_status).toMatchObject({ work_contract: true, visa: false });
    expect(minimumPerCandidate(contractCountryOf(updated))?.currency).toBe('SAR');
    expect(updated.contract_end_date).toBe('2028-11-01');
    for (const key of ['first_name', 'last_name', 'phone_number', 'email', 'emergency_contact', 'passport_number', 'tracking_code', 'home_city', 'coc_facility_id', 'clearance', 'ksa_visa'] as const) expect(updated[key]).toEqual(before[key]);
    expect(departureBlockers(updated)).toEqual(blockers);
    await expect(deleteDocument(doc.id)).rejects.toThrow('replacement contract');
    expect(getDocuments()).toHaveLength(1);
  });
  it('records foreign submission, not local receipt, and refuses unscoped uploads', async () => {
    const foreignReview = { ...review(), actor: { id: 'foreign-user', email: 'foreign@example.test', role: 'foreign-agency' as const, foreignAgencyId: 'foreign' } };
    await uploadDocument(candidate.id, 4, file(), report, foreignReview);
    expect(getCandidates()[0].work_contract_record?.status).toBe('sent');
    expect(getCandidates()[0].external_status?.work_contract).toBe(false);
    await expect(uploadDocument(candidate.id, 4, file(), report, { ...foreignReview, actor: { ...foreignReview.actor, foreignAgencyId: 'other' } })).rejects.toThrow('cannot submit');
    expect(getDocuments()).toHaveLength(1);
  });
  it('requires explicit review and file screening; the generic uploader cannot bypass contract review', async () => {
    await expect(uploadDocument(candidate.id, 4, file())).rejects.toThrow('contract scan');
    await expect(uploadDocument(candidate.id, 4, file(), report, { ...review(), confirmed: false })).rejects.toThrow('confirm');
    await expect(uploadDocument(candidate.id, 4, file(), undefined, review())).rejects.toThrow('Screen');
    await expect(uploadDocument(candidate.id, 1, file(), report, review())).rejects.toThrow('Deployment');
    await expect(uploadDocument(candidate.id, 4, file(), { ...report, status: 'blocked' }, review())).rejects.toThrow('blocked');
    expect(getDocuments()).toEqual([]);
    expect(saveDocumentFile).not.toHaveBeenCalled();
  });
  it('does not invent or inherit a different employer’s contact information', async () => {
    saveCandidates([{ ...candidate, employer: { company: 'Previous employer', phone: '+966500000009', email: 'old@example.test' } }]);
    await uploadDocument(candidate.id, 4, file(), report, { ...review(), fields: { employer: 'New employer' } });
    expect(getCandidates()[0].employer).toMatchObject({ company: 'New employer' });
    expect(getCandidates()[0].employer?.phone).toBeUndefined();
    expect(getCandidates()[0].employer?.email).toBeUndefined();
    await uploadDocument(candidate.id, 4, file(), report, { ...review(), fields: {} });
    expect(getCandidates()[0].employer?.company).toBe('New employer');
  });
  it('preserves candidate and document metadata if storing the original fails', async () => {
    const before = getCandidates();
    vi.mocked(saveDocumentFile).mockRejectedValue(new Error('Storage denied'));
    await expect(uploadDocument(candidate.id, 4, file(), report, review())).rejects.toThrow('Storage denied');
    expect(getCandidates()).toEqual(before);
    expect(getDocuments()).toEqual([]);
  });
  it('preserves introduction prerequisites for foreign contract submission', async () => {
    saveCandidates([{ ...candidate, intro_video_url: undefined }]);
    await expect(uploadDocument(candidate.id, 4, file(), report, { ...review(), actor: { id: 'foreign-user', email: 'foreign@example.test', role: 'foreign-agency', foreignAgencyId: 'foreign' } })).rejects.toThrow('must be complete');
    expect(getDocuments()).toEqual([]);
    expect(saveDocumentFile).not.toHaveBeenCalled();
  });
});
