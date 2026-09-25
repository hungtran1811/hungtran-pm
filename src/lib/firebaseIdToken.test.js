import { createSign, generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  decodeFirebaseIdToken,
  readFirebaseIdTokenClaims,
  resetSecureTokenCertsCache,
  verifyFirebaseIdToken,
  verifyJwtRs256,
} from './firebaseIdToken.js';

const projectId = 'hungtran-pm';

function signJwt(payload, privateKey, kid = 'test-kid') {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${header}.${body}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey, 'base64url');
  return `${signingInput}.${signature}`;
}

describe('readFirebaseIdTokenClaims', () => {
  it('accepts a Firebase ID token payload for this project', () => {
    expect(
      readFirebaseIdTokenClaims(
        {
          aud: projectId,
          iss: `https://securetoken.google.com/${projectId}`,
          email: 'Teacher@Example.com',
          sub: 'uid-1',
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        projectId,
      ),
    ).toEqual({ uid: 'uid-1', email: 'teacher@example.com' });
  });

  it('rejects a token from another project, without email, or expired', () => {
    expect(
      readFirebaseIdTokenClaims(
        {
          aud: 'other-app',
          iss: 'https://securetoken.google.com/other-app',
          email: 'a@b.c',
          sub: 'uid-1',
        },
        projectId,
      ),
    ).toBeNull();
    expect(
      readFirebaseIdTokenClaims(
        {
          aud: projectId,
          iss: `https://securetoken.google.com/${projectId}`,
          sub: 'uid-1',
        },
        projectId,
      ),
    ).toBeNull();
    expect(
      readFirebaseIdTokenClaims(
        {
          aud: projectId,
          iss: `https://securetoken.google.com/${projectId}`,
          email: 'a@b.c',
          sub: 'uid-1',
          exp: Math.floor(Date.now() / 1000) - 10,
        },
        projectId,
      ),
    ).toBeNull();
  });
});

describe('verifyFirebaseIdToken', () => {
  afterEach(() => {
    resetSecureTokenCertsCache();
  });

  it('verifies a signed JWT against the matching securetoken cert', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = publicKey.export({ type: 'spki', format: 'pem' });
    const token = signJwt(
      {
        aud: projectId,
        iss: `https://securetoken.google.com/${projectId}`,
        email: 'teacher@example.com',
        sub: 'uid-1',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      privateKey,
    );

    const decoded = decodeFirebaseIdToken(token);
    expect(decoded?.header.kid).toBe('test-kid');
    expect(verifyJwtRs256(decoded.signingInput, decoded.signature, pem)).toBe(true);

    const claims = await verifyFirebaseIdToken(token, projectId, async () => ({
      ok: true,
      headers: new Headers({ 'cache-control': 'max-age=3600' }),
      json: async () => ({ 'test-kid': pem }),
    }));
    expect(claims).toEqual({ uid: 'uid-1', email: 'teacher@example.com' });
  });

  it('rejects a token signed with another key', async () => {
    const first = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const second = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const token = signJwt(
      {
        aud: projectId,
        iss: `https://securetoken.google.com/${projectId}`,
        email: 'teacher@example.com',
        sub: 'uid-1',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      first.privateKey,
    );
    const otherPem = second.publicKey.export({ type: 'spki', format: 'pem' });

    await expect(
      verifyFirebaseIdToken(token, projectId, async () => ({
        ok: true,
        headers: new Headers({ 'cache-control': 'max-age=3600' }),
        json: async () => ({ 'test-kid': otherPem }),
      })),
    ).resolves.toBeNull();
  });
});
