import { describe, expect, it, vi } from 'vitest';
const { verify } = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: verify }) }));
import { authenticate } from '../src/auth/identity.js';
import { environment } from '../src/config.js';

describe('acesso com Google', () => {
  it('recusa visitantes no jogo local e aceita somente tokens Google verificados', async () => {
    const previous = environment.NODE_ENV;
    environment.NODE_ENV = 'development';
    try {
      await expect(authenticate({ guestId: 'guest-auth-check' })).rejects.toThrow('Google');
      verify.mockResolvedValue({
        uid: 'google-user',
        name: 'Treinador',
        firebase: { sign_in_provider: 'google.com' },
      });
      expect(await authenticate({ token: 'signed-token' })).toEqual({
        userId: 'google-user',
        name: 'Treinador',
        guest: false,
      });
      expect(verify).toHaveBeenCalledWith('signed-token', false);
      verify.mockResolvedValue({ uid: 'other-user', firebase: { sign_in_provider: 'password' } });
      await expect(authenticate({ token: 'other-token' })).rejects.toThrow('Google');
    } finally {
      environment.NODE_ENV = previous;
    }
  });
  it('mantém a verificação de revogação na produção', async () => {
    const previous = environment.NODE_ENV;
    environment.NODE_ENV = 'production';
    try {
      verify.mockResolvedValue({
        uid: 'google-user',
        firebase: { sign_in_provider: 'google.com' },
      });
      await authenticate({ token: 'production-token' });
      expect(verify).toHaveBeenCalledWith('production-token', true);
    } finally {
      environment.NODE_ENV = previous;
    }
  });
});
