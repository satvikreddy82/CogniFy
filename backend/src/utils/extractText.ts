/**
 * extractText.ts — Extract plain text from uploaded files.
 * Supported: PDF, DOCX, TXT. Images are not parseable server-side without Vision API.
 *
 * Returns { text, extractionMethod, warning? }
 * On complete failure: throws with a descriptive message so the caller can surface it.
 */

import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

export type ExtractionResult = {
  text: string;
  extractionMethod: 'pdf-parse' | 'mammoth' | 'plain-text' | 'raw-body';
  warning?: string;
};

/**
 * Extract text from a Buffer by MIME type / file extension.
 * @param buffer  The raw file buffer
 * @param mimeType  e.g. 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
 * @param fileName  Used as fallback hint when mimeType is ambiguous
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<ExtractionResult> {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  const mime = mimeType.toLowerCase();

  // ── PDF ──────────────────────────────────────────────────────────────────────
  if (mime.includes('pdf') || ext === 'pdf') {
    let parser: any;
    try {
      parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      const text = (typeof textResult === 'string' ? textResult : (textResult as any)?.text ?? '').trim();
      await parser.destroy();
      if (text.length < 20) {
        return {
          text: '',
          extractionMethod: 'pdf-parse',
          warning: `PDF "${fileName}" appears to be image-only or empty — no usable text extracted. Please upload a text-based PDF or enter questions manually.`,
        };
      }
      return { text, extractionMethod: 'pdf-parse' };
    } catch (err: any) {
      if (parser) {
        try { await parser.destroy(); } catch {}
      }
      throw new Error(`Failed to parse PDF "${fileName}": ${err.message}`);
    }
  }

  // ── DOCX ─────────────────────────────────────────────────────────────────────
  if (
    mime.includes('wordprocessingml') ||
    mime.includes('msword') ||
    ext === 'docx' ||
    ext === 'doc'
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value.trim();
      if (result.messages.length > 0) {
        console.warn(`[extractText] mammoth warnings for "${fileName}":`, result.messages);
      }
      if (text.length < 20) {
        return {
          text: '',
          extractionMethod: 'mammoth',
          warning: `DOCX "${fileName}" yielded no usable text. Please check the document or enter questions manually.`,
        };
      }
      return { text, extractionMethod: 'mammoth' };
    } catch (err: any) {
      throw new Error(`Failed to parse DOCX "${fileName}": ${err.message}`);
    }
  }

  // ── Plain text (TXT, CSV, etc.) ───────────────────────────────────────────────
  if (mime.includes('text/') || ext === 'txt' || ext === 'csv' || ext === 'md') {
    const text = buffer.toString('utf-8').trim();
    if (text.length < 20) {
      return {
        text: '',
        extractionMethod: 'plain-text',
        warning: `Text file "${fileName}" is empty or too short.`,
      };
    }
    return { text, extractionMethod: 'plain-text' };
  }

  // ── Image / unsupported ───────────────────────────────────────────────────────
  if (
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)
  ) {
    return {
      text: '',
      extractionMethod: 'raw-body',
      warning: `Image file "${fileName}" cannot be parsed server-side for text. Questions from this file will be generated using the course syllabus only. To extract questions from images, please convert them to a text-based PDF first.`,
    };
  }

  // ── Unrecognised format ───────────────────────────────────────────────────────
  throw new Error(
    `Unsupported file type for text extraction: "${fileName}" (${mimeType}). ` +
      'Supported: PDF, DOCX, TXT. Images (JPG/PNG) are uploaded but cannot be parsed for text.',
  );
}
