export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(),
    },
    body: JSON.stringify(body),
  };
}

export function parseJsonBody(event) {
  if (!event?.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  return JSON.parse(raw);
}

export function clientIp(event) {
  return (
    event?.headers?.['x-nf-client-connection-ip'] ||
    event?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    event?.headers?.['client-ip'] ||
    'unknown'
  );
}

export function requestOrigin(event) {
  return event?.headers?.origin || event?.headers?.Origin || '';
}

export function preflight(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Chỉ hỗ trợ POST.' });
  }
  return null;
}
