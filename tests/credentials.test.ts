import { describe, expect, it } from 'vitest';
import { normalizePrivateKey, readServiceAccount } from '@/lib/firebaseAdmin';

const PEM = '-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----\n';
const ESCAPED = PEM.replace(/\n/g, '\\n'); // what a single-line env var often holds

describe('service-account credentials', () => {
  it('turns literal \\n sequences back into newlines', () => {
    expect(normalizePrivateKey(ESCAPED)).toBe(PEM);
    expect(normalizePrivateKey(PEM)).toBe(PEM);
  });

  it('returns null when nothing is configured', () => {
    expect(readServiceAccount({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('reads the whole JSON key, including a doubly escaped private key', () => {
    const json = JSON.stringify({ project_id: 'p', client_email: 'a@b', private_key: ESCAPED });
    expect(
      readServiceAccount({ FIREBASE_SERVICE_ACCOUNT_KEY: json } as unknown as NodeJS.ProcessEnv)
    ).toEqual({ projectId: 'p', clientEmail: 'a@b', privateKey: PEM });
  });

  it('reads the split form and strips pasted quotes', () => {
    expect(
      readServiceAccount({
        FIREBASE_CLIENT_EMAIL: 'a@b',
        FIREBASE_PRIVATE_KEY: `"${ESCAPED}"`,
      } as unknown as NodeJS.ProcessEnv)
    ).toEqual({ clientEmail: 'a@b', privateKey: PEM });
  });

  it('refuses half of the split form and malformed JSON', () => {
    expect(() =>
      readServiceAccount({ FIREBASE_CLIENT_EMAIL: 'a@b' } as unknown as NodeJS.ProcessEnv)
    ).toThrow(/together/);
    expect(() =>
      readServiceAccount({ FIREBASE_SERVICE_ACCOUNT_KEY: '{nope' } as unknown as NodeJS.ProcessEnv)
    ).toThrow(/not valid JSON/);
  });
});
