import type { Document, UploadScanReport } from './types';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const REVIEW_FILE_BYTES = 10 * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set(['apk', 'bat', 'cmd', 'com', 'dll', 'exe', 'hta', 'html', 'htm', 'jar', 'js', 'mjs', 'ps1', 'scr', 'sh', 'svg']);
const MIME_BY_EXTENSION: Record<string, string[]> = {
  csv: ['text/csv', 'application/csv', 'text/plain'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  jpeg: ['image/jpeg'],
  jpg: ['image/jpeg'],
  pdf: ['application/pdf'],
  png: ['image/png'],
  txt: ['text/plain'],
  webp: ['image/webp'],
};

const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
const addReview = (findings: string[], finding: string) => findings.push(finding);

const fingerprintOf = async (bytes: ArrayBuffer): Promise<string | undefined> => {
  try {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  } catch {
    return undefined;
  }
};

export const scanDocumentFile = async (file: File, existingDocuments: Document[] = []): Promise<UploadScanReport> => {
  const findings: string[] = [];
  const extension = extensionOf(file.name);
  let blocked = false;

  if (!file.size) {
    findings.push('The selected file is empty.');
    blocked = true;
  }
  if (file.size > MAX_FILE_BYTES) {
    findings.push('The file exceeds the 25 MB upload limit.');
    blocked = true;
  } else if (file.size > REVIEW_FILE_BYTES) {
    addReview(findings, 'The file is larger than 10 MB and should be reviewed before storage.');
  }
  if (file.name.includes('/') || file.name.includes('\\') || file.name.includes(String.fromCharCode(0)) || file.name.startsWith('.')) {
    findings.push('The file name contains a hidden or path-like value.');
    blocked = true;
  }
  if (BLOCKED_EXTENSIONS.has(extension)) {
    findings.push(`The .${extension} file type is not accepted for candidate records.`);
    blocked = true;
  }

  const bytes = await file.arrayBuffer();
  const data = new Uint8Array(bytes);
  const mime = file.type.toLowerCase();
  const compatibleMimes = MIME_BY_EXTENSION[extension];
  if (compatibleMimes && mime && !compatibleMimes.includes(mime)) {
    addReview(findings, 'The file extension and declared MIME type do not match.');
  }
  if (!compatibleMimes && !blocked) {
    addReview(findings, 'The file type is not in the standard screening allowlist.');
  }

  const startsWith = (...signature: number[]) => signature.every((value, index) => data[index] === value);
  if (extension === 'pdf' && new TextDecoder().decode(data.slice(0, 8)).indexOf('%PDF-') !== 0) {
    findings.push('The file does not have a valid PDF signature.');
    blocked = true;
  } else if ((extension === 'jpg' || extension === 'jpeg') && !startsWith(0xff, 0xd8, 0xff)) {
    findings.push('The file does not have a valid JPEG signature.');
    blocked = true;
  } else if (extension === 'png' && !startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    findings.push('The file does not have a valid PNG signature.');
    blocked = true;
  } else if (extension === 'webp' && (new TextDecoder().decode(data.slice(0, 4)) !== 'RIFF' || new TextDecoder().decode(data.slice(8, 12)) !== 'WEBP')) {
    findings.push('The file does not have a valid WebP signature.');
    blocked = true;
  }

  if (extension === 'pdf') {
    const pdfText = new TextDecoder('latin1').decode(data);
    if (/\/(?:JavaScript|JS|Launch|EmbeddedFile|OpenAction)\b/i.test(pdfText)) {
      addReview(findings, 'The PDF contains active content or embedded-file markers.');
    }
  } else if (extension === 'csv') {
    const csvText = new TextDecoder().decode(data);
    if (/(?:^|[,;\t])\s*[=+@]/m.test(csvText)) {
      addReview(findings, 'The CSV contains formula-like cells that can execute when opened in spreadsheet software.');
    }
  }

  const fingerprint = await fingerprintOf(bytes);
  if (fingerprint && existingDocuments.some(document => document.scan_report?.fingerprint === fingerprint)) {
    addReview(findings, 'This file is identical to a document already on the candidate record.');
  }

  return {
    status: blocked ? 'blocked' : findings.length ? 'review' : 'clear',
    findings,
    scanned_at: new Date().toISOString(),
    fingerprint,
  };
};
