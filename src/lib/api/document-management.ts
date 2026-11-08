import { v4 as uuidv4 } from 'uuid';
import { Document, UploadScanReport } from '../types';
import { getDocuments, saveDocuments, getCandidates } from '../data-store';
import { saveDocumentFile, deleteDocumentFile } from '../document-files';

// POST /api/admin/candidate/:id/upload
export const uploadDocument = async (
    candidateId: string,
    stageId: number,
    file: File,
    scanReport?: UploadScanReport,
): Promise<Document> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const documents = getDocuments();
    const candidate = getCandidates().find(c => c.id === candidateId);

    if (!candidate) throw new Error("Candidate not found.");
    if (file.size > 15 * 1024 * 1024 || file.size === 0) throw new Error('Choose a nonempty document of 15 MB or less.');
    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Documents must be PDF, PNG, JPEG or WebP.');
    if (scanReport?.status === 'blocked') throw new Error('This document is blocked by the upload screening.');

    const newDoc: Document = {
        id: uuidv4(),
        candidate_id: candidateId,
        stage_id: stageId,
        file_name: file.name,
        file_type: file.type,
        storage_key: `docs/${candidate.tracking_code}/${file.name}`,
        uploaded_at: new Date().toISOString(),
        scan_report: scanReport,
    };

    await saveDocumentFile(newDoc.id, file);
    documents.push(newDoc);
    try { saveDocuments(documents); }
    catch (error) {
        try { await deleteDocumentFile(newDoc.id); }
        catch (cleanupError) { console.error('Could not remove the unregistered document file.', cleanupError); }
        throw error;
    }
    return newDoc;
};

// DELETE /api/admin/document/:id
export const deleteDocument = async (documentId: string): Promise<{ success: boolean }> => {
    await new Promise(resolve => setTimeout(resolve, 100));
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