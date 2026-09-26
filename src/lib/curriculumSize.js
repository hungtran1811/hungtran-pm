export const LESSON_DOCUMENT_MAX_BYTES = 750 * 1024;

export function lessonDocumentSizeBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
