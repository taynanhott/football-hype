import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { describe, it, expect, vi } from 'vitest';
import { authenticate } from '../src/auth.js';
describe('Tokens Firebase no Worker', () => {
  it('valida assinatura, projeto, provedor Google e App Check', async () => {
    const keys = await generateKeyPair('RS256');
    const jwk = {
      ...(await exportJWK(keys.publicKey)),
      kid: 'worker-test',
      alg: 'RS256',
      use: 'sig',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ keys: [jwk] })),
    );
    const sign = (payload: Record<string, unknown>, issuer: string, audience: string) =>
      new SignJWT(payload)
        .setProtectedHeader({ alg: 'RS256', kid: 'worker-test' })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject('test-user')
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(keys.privateKey);
    try {
      const token = await sign(
        { firebase: { sign_in_provider: 'google.com' }, name: 'Técnico' },
        'https://securetoken.google.com/test-project',
        'test-project',
      );
      const appCheckToken = await sign(
        {},
        'https://firebaseappcheck.googleapis.com/123',
        'projects/123',
      );
      expect((await authenticate({ token, appCheckToken }, 'test-project', '123')).userId).toBe(
        'test-user',
      );
      await expect(
        authenticate({ token, appCheckToken }, 'another-project', '123'),
      ).rejects.toThrow();
      await expect(authenticate({ token }, 'test-project', '123')).rejects.toThrow();
      const invalidProvider = await sign(
        { firebase: { sign_in_provider: 'password' } },
        'https://securetoken.google.com/test-project',
        'test-project',
      );
      await expect(
        authenticate({ token: invalidProvider, appCheckToken }, 'test-project', '123'),
      ).rejects.toThrow();
      const wrongApp = await sign(
        {},
        'https://firebaseappcheck.googleapis.com/456',
        'projects/456',
      );
      await expect(
        authenticate({ token, appCheckToken: wrongApp }, 'test-project', '123'),
      ).rejects.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
