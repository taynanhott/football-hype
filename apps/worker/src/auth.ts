import { createRemoteJWKSet, jwtVerify } from 'jose';
import { connectOptionsSchema } from '@football/shared';
import type { Identity } from '../../server/src/auth/identity.js';
const authKeys = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
);
const appKeys = createRemoteJWKSet(new URL('https://firebaseappcheck.googleapis.com/v1/jwks'));
export async function authenticate(
  input: unknown,
  projectId: string,
  projectNumber: string,
): Promise<Identity> {
  const options = connectOptionsSchema.parse(input);
  if (!options.token || !options.appCheckToken)
    throw new Error('Entre com sua conta Google e valide o App Check');
  const { payload } = await jwtVerify(options.token, authKeys, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ['RS256'],
  });
  const app = await jwtVerify(options.appCheckToken, appKeys, {
    issuer: `https://firebaseappcheck.googleapis.com/${projectNumber}`,
    audience: `projects/${projectNumber}`,
    algorithms: ['RS256'],
  });
  const firebase = payload.firebase as { sign_in_provider?: string } | undefined;
  if (!payload.sub || firebase?.sign_in_provider !== 'google.com' || !app.payload.sub)
    throw new Error('Sessão inválida');
  return { userId: payload.sub, name: String(payload.name ?? 'Treinador'), guest: false };
}
