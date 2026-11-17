import { generateKeyPairSync, createVerify } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { createCustomToken } from './firebaseAdmin.js';

const previous = process.env.FIREBASE_SERVICE_ACCOUNT;

afterEach(() => {
  if (previous === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT;
  else process.env.FIREBASE_SERVICE_ACCOUNT = previous;
});

describe('createCustomToken', () => {
  it('signs a student token the Auth client can verify', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
      project_id: 'demo',
      client_email: 'demo@demo.iam.gserviceaccount.com',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    });
    const token = createCustomToken('stu_student-1', { studentId: 'student-1', credentialVersion: 2 });
    const [header, body, signature] = token.split('.');
    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toMatchObject({ alg: 'RS256', typ: 'JWT' });
    expect(JSON.parse(Buffer.from(body, 'base64url').toString())).toMatchObject({
      uid: 'stu_student-1',
      iss: 'demo@demo.iam.gserviceaccount.com',
      claims: { studentId: 'student-1', credentialVersion: 2 },
    });
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${header}.${body}`);
    verifier.end();
    expect(verifier.verify(publicKey, signature, 'base64url')).toBe(true);
  });
});
