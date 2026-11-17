import { createServer } from 'node:http';
import { handler as createUploadSession } from '../netlify/functions/drive-create-upload-session.js';
import { handler as completeSubmission } from '../netlify/functions/drive-complete-submission.js';
import { handler as listMySubmissions } from '../netlify/functions/drive-list-my-submissions.js';
import { handler as createMaterialSession } from '../netlify/functions/drive-create-material-session.js';
import { handler as completeMaterial } from '../netlify/functions/drive-complete-material.js';
import { handler as driveHealth } from '../netlify/functions/drive-health.js';
import { handler as createLessonHtmlSession } from '../netlify/functions/drive-create-lesson-html-session.js';
import { handler as completeLessonHtml } from '../netlify/functions/drive-complete-lesson-html.js';
import { handler as getLessonHtml } from '../netlify/functions/drive-get-lesson-html.js';
import { handler as deleteLessonHtml } from '../netlify/functions/drive-delete-lesson-html.js';
import { handler as classResolve } from '../netlify/functions/class-resolve.js';
import { handler as pinGate } from '../netlify/functions/pin-gate.js';
import { handler as pinClaim } from '../netlify/functions/pin-claim.js';
import { handler as pinVerify } from '../netlify/functions/pin-verify.js';
import { handler as pinResetRequest } from '../netlify/functions/pin-reset-request.js';
import { handler as pinResetApprove } from '../netlify/functions/pin-reset-approve.js';
import { handler as pinResetSet } from '../netlify/functions/pin-reset-set.js';
import { handler as pinLock } from '../netlify/functions/pin-lock.js';
import { handler as pinStatus } from '../netlify/functions/pin-status.js';
import { handler as classAccessAudit } from '../netlify/functions/class-access-audit.js';
import { handler as upLevel } from '../netlify/functions/up-level.js';

const handlers = new Map([
  ['/drive-create-upload-session', createUploadSession],
  ['/drive-complete-submission', completeSubmission],
  ['/drive-list-my-submissions', listMySubmissions],
  ['/drive-create-material-session', createMaterialSession],
  ['/drive-complete-material', completeMaterial],
  ['/drive-health', driveHealth],
  ['/drive-create-lesson-html-session', createLessonHtmlSession],
  ['/drive-complete-lesson-html', completeLessonHtml],
  ['/drive-get-lesson-html', getLessonHtml],
  ['/drive-delete-lesson-html', deleteLessonHtml],
  ['/.netlify/functions/drive-create-upload-session', createUploadSession],
  ['/.netlify/functions/drive-complete-submission', completeSubmission],
  ['/.netlify/functions/drive-list-my-submissions', listMySubmissions],
  ['/.netlify/functions/drive-create-material-session', createMaterialSession],
  ['/.netlify/functions/drive-complete-material', completeMaterial],
  ['/.netlify/functions/drive-health', driveHealth],
  ['/.netlify/functions/drive-create-lesson-html-session', createLessonHtmlSession],
  ['/.netlify/functions/drive-complete-lesson-html', completeLessonHtml],
  ['/.netlify/functions/drive-get-lesson-html', getLessonHtml],
  ['/.netlify/functions/drive-delete-lesson-html', deleteLessonHtml],
  ['/class-resolve', classResolve],
  ['/pin-gate', pinGate],
  ['/pin-claim', pinClaim],
  ['/pin-verify', pinVerify],
  ['/pin-reset-request', pinResetRequest],
  ['/pin-reset-approve', pinResetApprove],
  ['/pin-reset-set', pinResetSet],
  ['/pin-lock', pinLock],
  ['/pin-status', pinStatus],
  ['/class-access-audit', classAccessAudit],
  ['/up-level', upLevel],
  ['/.netlify/functions/class-resolve', classResolve],
  ['/.netlify/functions/pin-gate', pinGate],
  ['/.netlify/functions/pin-claim', pinClaim],
  ['/.netlify/functions/pin-verify', pinVerify],
  ['/.netlify/functions/pin-reset-request', pinResetRequest],
  ['/.netlify/functions/pin-reset-approve', pinResetApprove],
  ['/.netlify/functions/pin-reset-set', pinResetSet],
  ['/.netlify/functions/pin-lock', pinLock],
  ['/.netlify/functions/pin-status', pinStatus],
  ['/.netlify/functions/class-access-audit', classAccessAudit],
  ['/.netlify/functions/up-level', upLevel],
]);

const port = Number(process.env.FUNCTIONS_PORT || 8888);

function toEvent(req, body) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    headers[key] = Array.isArray(value) ? value.join(',') : value || '';
  }
  return {
    httpMethod: req.method,
    headers,
    body,
    isBase64Encoded: false,
  };
}

createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const handler = handlers.get(url.pathname);
  if (!handler) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('utf8');

  try {
    const result = await handler(toEvent(req, body));
    res.writeHead(result.statusCode || 200, result.headers || {});
    res.end(result.body || '');
  } catch (error) {
    console.error('[serve-drive-functions]', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Máy chủ nộp bài đang lỗi.' }));
  }
}).listen(port, () => {
  console.log(`Drive functions ready on http://localhost:${port}`);
});
