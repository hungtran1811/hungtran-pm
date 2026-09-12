import { createServer } from 'node:http';
import { handler as createUploadSession } from '../netlify/functions/drive-create-upload-session.js';
import { handler as completeSubmission } from '../netlify/functions/drive-complete-submission.js';
import { handler as listMySubmissions } from '../netlify/functions/drive-list-my-submissions.js';

const handlers = new Map([
  ['/drive-create-upload-session', createUploadSession],
  ['/drive-complete-submission', completeSubmission],
  ['/drive-list-my-submissions', listMySubmissions],
  ['/.netlify/functions/drive-create-upload-session', createUploadSession],
  ['/.netlify/functions/drive-complete-submission', completeSubmission],
  ['/.netlify/functions/drive-list-my-submissions', listMySubmissions],
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
