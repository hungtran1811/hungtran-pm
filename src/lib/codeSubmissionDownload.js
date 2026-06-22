import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { codeSubmissionDocId } from './codeSubmissionLimits.js';

const COL = 'projectCodeSubmissions';

export async function fetchCodeFileContent(classCode, studentId, sessionNumber, fileId) {
  const parentId = codeSubmissionDocId(classCode, studentId, sessionNumber);
  const snap = await getDoc(doc(db, COL, parentId, 'files', fileId));
  if (!snap.exists()) return null;
  return snap.data()?.content ?? null;
}

export function downloadTextFile(content, fileName, contentType = 'text/plain') {
  const blob = new Blob([content], { type: `${contentType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadCodeSubmissionFile({
  classCode,
  studentId,
  sessionNumber,
  fileId,
  fileName,
  contentType = 'text/plain',
}) {
  const content = await fetchCodeFileContent(classCode, studentId, sessionNumber, fileId);
  if (content == null) throw new Error('Không tìm thấy nội dung file.');
  downloadTextFile(content, fileName, contentType);
}
