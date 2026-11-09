import { v4 as uuidv4 } from 'uuid';
import { Document, UploadScanReport, ExtractedDocumentFields, UserRole } from '../types';
import { getDocuments, saveDocuments, getCandidates, saveCandidates } from '../data-store';
import { saveDocumentFile, deleteDocumentFile } from '../document-files';
import { normalizeContractFields } from '../contract-extraction';
import { hasCompleteCandidateIntroduction } from '../candidate-introduction';

export interface ContractUploadReview {
    fields: ExtractedDocumentFields;
    scannedPages: number;
    confirmed: boolean;
    actor: { id: string; email: string; role: UserRole; localAgencyId?: string | null; foreignAgencyId?: string | null };
}

// POST /api/admin/candidate/:id/upload
export const uploadDocument = async (
    candidateId: string,
    stageId: number,
    file: File,
    scanReport?: UploadScanReport,
    contractReview?: ContractUploadReview,
): Promise<Document> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidate = getCandidates().find(c => c.id === candidateId);

    if (!candidate) throw new Error("Candidate not found.");
    if (file.size > 15 * 1024 * 1024 || file.size === 0) throw new Error('Choose a nonempty document of 15 MB or less.');
    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Documents must be PDF, PNG, JPEG or WebP.');
    if (scanReport?.status === 'blocked') throw new Error('This document is blocked by the upload screening.');
    let contractFields: ExtractedDocumentFields | undefined;
    if (contractReview) {
        const { actor } = contractReview;
        const permitted = ['superadmin', 'admin'].includes(actor.role)
            || (['local-agency', 'staff'].includes(actor.role) && !!actor.localAgencyId && candidate.local_agency_id === actor.localAgencyId)
            || (actor.role === 'staff' && candidate.assigned_staff_id === actor.id)
            || (['agency', 'foreign-agency', 'foreign-agency-staff'].includes(actor.role) && !!actor.foreignAgencyId
                && (candidate.foreign_agency_id === actor.foreignAgencyId || candidate.profile_shares?.some(share => share.foreign_agency_id === actor.foreignAgencyId)));
        if (!actor.id || !actor.email || !permitted) throw new Error('You cannot submit contract evidence for this candidate.');
        if (['agency', 'foreign-agency', 'foreign-agency-staff'].includes(actor.role) && !hasCompleteCandidateIntroduction(candidate)) {
            throw new Error('The ministry-owned introduction, gender, skills, languages and video must be complete before sending a contract.');
        }
        if (!contractReview.confirmed || !scanReport || !Number.isInteger(contractReview.scannedPages) || contractReview.scannedPages < 0 || contractReview.scannedPages > 4) {
            throw new Error('Screen the contract and confirm the extracted fields against the original before saving.');
        }
        if (stageId !== 4) throw new Error('Employment contracts belong to the Deployment stage.');
        contractFields = normalizeContractFields(contractReview.fields);
    }
    if (!contractReview && /\b(?:work[\s_-]*)?contract\b/i.test(file.name.replace(/[_-]+/g, ' '))) {
        throw new Error('Use the contract scan and review uploader to save employment contracts and employer details.');
    }

    const newDoc: Document = {
        id: uuidv4(),
        candidate_id: candidateId,
        stage_id: stageId,
        file_name: file.name,
        file_type: file.type,
        storage_key: `docs/${candidate.tracking_code}/${file.name}`,
        uploaded_at: new Date().toISOString(),
        scan_report: scanReport,
        doc_kind: /\bvisa\b/i.test(file.name.replace(/[_-]+/g, ' ')) ? 'visa' : 'other',
        ...(contractReview ? {
            doc_kind: 'work_contract' as const, extracted: contractFields,
            extraction_review: { reviewed_at: new Date().toISOString(), reviewed_by: contractReview.actor.email, scanned_pages: contractReview.scannedPages },
        } : {}),
    };

    await saveDocumentFile(newDoc.id, file);
    const documents = getDocuments();
    documents.push(newDoc);
    try {
        saveDocuments(documents);
        if (contractReview && contractFields) {
            const candidates = getCandidates();
            const index = candidates.findIndex(item => item.id === candidateId);
            if (index < 0) throw new Error('Candidate was removed while uploading the contract.');
            const current = candidates[index];
            const now = newDoc.uploaded_at;
            const sent = ['agency', 'foreign-agency', 'foreign-agency-staff'].includes(contractReview.actor.role);
            const employer = contractFields.employer ? {
                ...(current.employer?.company === contractFields.employer ? current.employer : {}),
                company: contractFields.employer,
                ...(contractFields.employer_contact_name ? { contact_name: contractFields.employer_contact_name } : {}),
                ...(contractFields.employer_phone ? { phone: contractFields.employer_phone } : {}),
                ...(contractFields.employer_email ? { email: contractFields.employer_email } : {}),
                ...(contractFields.employer_address ? { address: contractFields.employer_address } : {}),
                source_document_id: newDoc.id, reviewed_at: now, reviewed_by: contractReview.actor.email,
            } : current.employer;
            candidates[index] = {
                ...current, employer, updated_at: now,
                contract_start_date: contractFields.start_date,
                contract_end_date: contractFields.expiry_date,
                external_status: {
                    ...current.external_status, work_contract: !sent,
                    destination_country: contractFields.destination_country,
                    destination_city: contractFields.destination_city, updated_at: now,
                },
                work_contract_record: {
                    status: sent ? 'sent' : 'received', document_id: newDoc.id,
                    ...(sent ? { sent_at: now, sent_by: contractReview.actor.email } : { received_at: now, received_by: contractReview.actor.email }),
                },
            };
            saveCandidates(candidates);
        }
    }
    catch (error) {
        try { saveDocuments(getDocuments().filter(document => document.id !== newDoc.id)); }
        catch (cleanupError) { console.error('Could not roll back contract document metadata.', cleanupError); }
        try { await deleteDocumentFile(newDoc.id); }
        catch (cleanupError) { console.error('Could not remove the unregistered document file.', cleanupError); }
        throw error;
    }
    window.dispatchEvent(new CustomEvent('supabase-data-changed'));
    return newDoc;
};

// DELETE /api/admin/document/:id
export const deleteDocument = async (documentId: string): Promise<{ success: boolean }> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    if (getCandidates().some(candidate => candidate.work_contract_record?.document_id === documentId)) {
        throw new Error('Upload a replacement contract before deleting the current employer-contact source document.');
    }
    let documents = getDocuments();
    const initialLength = documents.length;

    documents = documents.filter(doc => doc.id !== documentId);

    if (documents.length === initialLength) {
        throw new Error("Document not found.");
    }

    await deleteDocumentFile(documentId);
    saveDocuments(documents);
    return { success: true };
};