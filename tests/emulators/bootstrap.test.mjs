import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

const projectId = 'demo-football-manager';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;

assert.ok(authHost, 'Execute com pnpm test:emulators');
assert.ok(firestoreHost, 'Execute com pnpm test:emulators');
assert.match(authHost, /^127\.0\.0\.1:\d+$/);
assert.match(firestoreHost, /^127\.0\.0\.1:\d+$/);

test('Authentication cria uma identidade local e Firestore bloqueia o acesso', async () => {
  const signup = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${randomUUID()}@example.test`,
        password: randomUUID(),
        returnSecureToken: true,
      }),
    },
  );
  assert.equal(signup.status, 200);
  const identity = await signup.json();
  assert.equal(typeof identity.idToken, 'string');

  const documentUrl = `http://${firestoreHost}/v1/projects/${projectId}/databases/(default)/documents/bootstrap/${randomUUID()}`;

  for (const headers of [{}, { Authorization: `Bearer ${identity.idToken}` }]) {
    const read = await fetch(documentUrl, { headers });
    assert.equal(read.status, 403);
    const write = await fetch(documentUrl, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { status: { stringValue: 'test' } } }),
    });
    assert.equal(write.status, 403);
  }
});
