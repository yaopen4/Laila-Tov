import { describe, expect, it } from 'vitest';
import { SignJWT, UnsecuredJWT, exportJWK, generateKeyPair, importJWK } from 'jose';

import { emulatorSessionsAllowed, rolesForPath, verifySessionCookie } from '@/lib/session';

const PROJECT = 'laila-tov-prod';
const ISSUER = `https://session.firebase.google.com/${PROJECT}`;
const CLAIMS = { role: 'coach', organizationId: 'org-1' };

async function signer() {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  const getKey = async () => importJWK(jwk, 'RS256');
  const sign = (claims: Record<string, unknown>, opts: { iss?: string; aud?: string; exp?: string } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setSubject('uid-1')
      .setIssuer(opts.iss ?? ISSUER)
      .setAudience(opts.aud ?? PROJECT)
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? '1h')
      .sign(privateKey);
  return { getKey, sign };
}

describe('verifySessionCookie (signed, production)', () => {
  it('accepts a valid cookie and returns its identity', async () => {
    const { getKey, sign } = await signer();
    await expect(verifySessionCookie(await sign(CLAIMS), { projectId: PROJECT, getKey })).resolves.toEqual({
      uid: 'uid-1',
      role: 'coach',
      organizationId: 'org-1',
    });
  });

  it('rejects another project, an expired cookie, a foreign key, and missing claims', async () => {
    const { getKey, sign } = await signer();
    const other = await signer();
    const opts = { projectId: PROJECT, getKey };

    expect(await verifySessionCookie(await sign(CLAIMS, { aud: 'someone-else' }), opts)).toBeNull();
    expect(
      await verifySessionCookie(await sign(CLAIMS, { iss: 'https://session.firebase.google.com/x' }), opts)
    ).toBeNull();
    expect(await verifySessionCookie(await sign(CLAIMS, { exp: '-1m' }), opts)).toBeNull();
    expect(await verifySessionCookie(await other.sign(CLAIMS), opts)).toBeNull();
    expect(await verifySessionCookie(await sign({ role: 'superuser', organizationId: 'o' }), opts)).toBeNull();
    expect(await verifySessionCookie(await sign({ role: 'coach' }), opts)).toBeNull();
    expect(await verifySessionCookie(undefined, opts)).toBeNull();
  });

  it('never accepts an unsigned cookie unless emulator mode allows it', async () => {
    const unsigned = new UnsecuredJWT(CLAIMS)
      .setSubject('uid-1')
      .setIssuer(ISSUER)
      .setAudience(PROJECT)
      .setExpirationTime('1h')
      .encode();
    const { getKey } = await signer();

    expect(await verifySessionCookie(unsigned, { projectId: PROJECT, getKey })).toBeNull();
    expect(await verifySessionCookie(unsigned, { projectId: PROJECT, allowUnsigned: true })).not.toBeNull();
  });
});

describe('emulatorSessionsAllowed', () => {
  it('requires both the emulator flag and a demo- project', () => {
    expect(emulatorSessionsAllowed({ useEmulators: 'true', projectId: 'demo-laila-tov' })).toBe(true);
    expect(emulatorSessionsAllowed({ useEmulators: 'true', projectId: 'laila-tov' })).toBe(false);
    expect(emulatorSessionsAllowed({ useEmulators: 'false', projectId: 'demo-laila-tov' })).toBe(false);
    expect(emulatorSessionsAllowed({ projectId: 'demo-x' })).toBe(false);
  });
});

describe('rolesForPath', () => {
  it('maps each protected area to its roles', () => {
    expect(rolesForPath('/admin/users')).toEqual(['admin']);
    expect(rolesForPath('/coach/dashboard')).toEqual(['coach']);
    expect(rolesForPath('/parent/abc')).toEqual(['parent', 'coach', 'admin']);
    expect(rolesForPath('/')).toBeNull();
    expect(rolesForPath('/signup')).toBeNull();
    expect(rolesForPath('/administrator')).toBeNull();
  });
});
