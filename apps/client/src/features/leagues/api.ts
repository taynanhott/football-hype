import { z } from 'zod';
import { playerSchema } from '@football/shared';

export const serverUrl = z
  .url()
  .parse(import.meta.env.VITE_GAME_SERVER_URL ?? 'ws://127.0.0.1:2567');
export const testAuth =
  import.meta.env.MODE === 'test' && import.meta.env.VITE_TEST_AUTH === 'true';
export const firebaseEnabled = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_API_KEY !== 'demo-api-key',
);
const guestId = localStorage.getItem('football.guest') ?? crypto.randomUUID();
localStorage.setItem('football.guest', guestId);
export async function credentials() {
  if (!testAuth && firebaseEnabled) {
    const firebase = await import('../auth/firebase');
    const tokens = await firebase.firebaseCredentials();
    if (tokens.token) return { ...tokens, userId: firebase.auth.currentUser?.uid ?? guestId };
  }
  if (testAuth) return { guestId, userId: guestId };
  throw new Error('Entre com sua conta Google');
}
export async function request(path: string, init?: RequestInit): Promise<unknown> {
  const identity = await credentials();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if ('token' in identity && identity.token) headers.Authorization = `Bearer ${identity.token}`;
  if ('appCheckToken' in identity && identity.appCheckToken)
    headers['X-Firebase-AppCheck'] = identity.appCheckToken;
  if ('guestId' in identity && identity.guestId) headers['X-Guest-Id'] = identity.guestId;
  const response = await fetch(`${serverUrl.replace(/^ws/, 'http')}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(15000),
  });
  const data: unknown = await response.json();
  if (!response.ok) throw new Error(z.object({ error: z.string() }).parse(data).error);
  return data;
}
export async function createLeague(
  name: string,
  mode: 'offline' | 'multiplayer',
  clubId: string,
  assignment: 'chosen' | 'random',
) {
  return z.object({ id: z.uuid() }).parse(
    await request('/api/leagues', {
      method: 'POST',
      body: JSON.stringify({ name, mode, clubId, assignment }),
    }),
  ).id;
}
export async function listLeagues() {
  return z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        mode: z.enum(['offline', 'multiplayer']),
        season: z.number(),
        round: z.number(),
        administratorId: z.string(),
      }),
    )
    .parse(await request('/api/leagues'));
}
export async function searchPlayers(leagueId: string, query: string) {
  return z
    .array(playerSchema)
    .parse(await request(`/api/leagues/${leagueId}/players?q=${encodeURIComponent(query)}`));
}

export async function loadCatalog() {
  const response = await fetch(serverUrl.replace(/^ws/, 'http') + '/api/catalog', {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Não foi possível carregar a base de clubes');
  return z
    .object({
      source: z.string(),
      imported: z.boolean(),
      clubs: z
        .array(
          z.object({
            id: z.uuid(),
            name: z.string(),
            division: z.string(),
            crestUrl: z.url().optional(),
          }),
        )
        .min(1),
    })
    .parse(await response.json());
}
