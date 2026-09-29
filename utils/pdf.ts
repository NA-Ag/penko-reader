import * as pdfjsLib from 'pdfjs-dist';
// Bundle the worker so PDFs work fully offline.
// @ts-ignore - Vite url import
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/*
 * This module is heavy (pdf.js). Import it lazily: `const { pdfjs } = await import('./pdf')`.
 */

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type GetDocumentSource = Parameters<typeof pdfjsLib.getDocument>[0];

/**
 * getDocument with hardened defaults. `isEvalSupported: false` closes the font-rendering
 * code-execution hole in pdf.js <= 4.1.392 (CVE-2024-4367) for every caller.
 */
const safeGetDocument = (src: GetDocumentSource) => {
  const params =
    typeof src === 'string' || src instanceof URL ? { url: src }
      : src instanceof ArrayBuffer || ArrayBuffer.isView(src) ? { data: src }
        : src;
  return pdfjsLib.getDocument({ ...params, isEvalSupported: false });
};

/** Shared, configured pdf.js instance (one worker bundle for the whole app). */
export const pdfjs: typeof pdfjsLib = { ...pdfjsLib, getDocument: safeGetDocument as typeof pdfjsLib.getDocument };

/** A readable message for pdf.js load failures. */
export const pdfErrorMessage = (e: unknown): string => {
  const err = e as { name?: string; message?: string } | undefined;
  switch (err?.name) {
    case 'PasswordException': return 'This PDF is password-protected and can’t be opened.';
    case 'InvalidPDFException': return 'This file is not a valid PDF, or it is damaged.';
    case 'MissingPDFException': return 'The PDF file is empty.';
    default: return `Failed to open PDF${err?.message ? `: ${err.message}` : ''}`;
  }
};
