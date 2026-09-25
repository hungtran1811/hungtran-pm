import { describe, expect, it } from 'vitest';
import { readFirebaseIdTokenClaims } from './firebaseIdToken.js';

const projectId = 'hungtran-pm';

describe('readFirebaseIdTokenClaims', () => {
  it('accepts a Firebase ID token payload for this project', () => {
    expect(
      readFirebaseIdTokenClaims(
        {
          aud: projectId,
          iss: `https://securetoken.google.com/${projectId}`,
          email: 'Teacher@Example.com',
          sub: 'uid-1',
        },
        projectId,
      ),
    ).toEqual({ uid: 'uid-1', email: 'teacher@example.com' });
  });

  it('rejects a token from another project or without email', () => {
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
  });
});
