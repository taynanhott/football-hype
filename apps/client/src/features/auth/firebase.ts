import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  onAuthStateChanged,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { connectFirestoreEmulator, doc, getFirestore, onSnapshot } from 'firebase/firestore';
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { z } from 'zod';

const config = z
  .object({
    apiKey: z.string().min(1),
    authDomain: z.string().min(1),
    projectId: z.string().min(1),
    appId: z.string().min(1),
    storageBucket: z.string().optional(),
    messagingSenderId: z.string().optional(),
    measurementId: z.string().optional(),
  })
  .parse({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  });
const app = initializeApp({
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  appId: config.appId,
  ...(config.storageBucket ? { storageBucket: config.storageBucket } : {}),
  ...(config.messagingSenderId ? { messagingSenderId: config.messagingSenderId } : {}),
  ...(config.measurementId ? { measurementId: config.measurementId } : {}),
});
export const auth = getAuth(app);
const db = getFirestore(app);
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY as string | undefined;
const appCheck = siteKey
  ? initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    })
  : undefined;
export async function googleLogin(): Promise<User> {
  return (await signInWithPopup(auth, new GoogleAuthProvider())).user;
}
export async function logout(): Promise<void> {
  const { listLeagues, request } = await import('../leagues/api');
  for (const league of await listLeagues())
    if (league.mode === 'multiplayer')
      await request(`/api/leagues/${league.id}/leave`, { method: 'POST' });
  await signOut(auth);
}
export async function firebaseCredentials() {
  await auth.authStateReady();
  const token = await auth.currentUser?.getIdToken();
  const appCheckToken = appCheck ? (await getToken(appCheck)).token : undefined;
  return { ...(token ? { token } : {}), ...(appCheckToken ? { appCheckToken } : {}) };
}
export function observeLeague(
  id: string,
  update: () => void,
  fail: (error: Error) => void,
): () => void {
  return onSnapshot(doc(db, 'leagues', id), update, fail);
}

export function observeUser(listener: (user: User | null) => void) {
  return onAuthStateChanged(auth, listener);
}
