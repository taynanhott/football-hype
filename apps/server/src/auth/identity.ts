import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getAppCheck } from 'firebase-admin/app-check';
import { connectOptionsSchema } from '@football/shared';
import { environment } from '../config.js';

export const firebaseApp = getApps()[0] ?? initializeApp({ projectId: environment.GCLOUD_PROJECT });
export type Identity = Readonly<{ userId: string; name: string; guest: boolean }>;
export async function authenticate(input: unknown): Promise<Identity> {
  const options = connectOptionsSchema.parse(input);
  if (environment.REQUIRE_APP_CHECK === 'true') {
    if (!options.appCheckToken) throw new Error('App Check é obrigatório');
    await getAppCheck(firebaseApp).verifyToken(options.appCheckToken);
  }
  if (options.token) {
    const token = await getAuth(firebaseApp).verifyIdToken(
      options.token,
      environment.NODE_ENV === 'production',
    );
    if (token.firebase.sign_in_provider !== 'google.com')
      throw new Error('Utilize sua conta Google');
    return { userId: token.uid, name: String(token.name ?? 'Treinador'), guest: false };
  }
  if (
    environment.NODE_ENV === 'test' &&
    options.guestId &&
    /^[a-zA-Z0-9-]{8,128}$/.test(options.guestId)
  )
    return { userId: options.guestId, name: 'Treinador local', guest: true };
  throw new Error('Entre com sua conta Google');
}
