import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

let environment;
before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-football-manager',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8'),
    },
  });
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'leagues/security-league'), {
      participantIds: ['trainer-a'],
      revision: 0,
      status: 'active',
    });
    await setDoc(doc(db, 'leagues/security-league/events/event-a'), {
      message: 'Evento privado da liga',
    });
    await setDoc(doc(db, 'memberships/trainer-a'), { offline: 'security-league' });
  });
});
after(async () => {
  await environment?.cleanup();
});

test('membro pode ler liga e eventos; visitantes e terceiros não podem', async () => {
  const member = environment.authenticatedContext('trainer-a').firestore();
  const outsider = environment.authenticatedContext('trainer-b').firestore();
  const visitor = environment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(member, 'leagues/security-league')));
  await assertSucceeds(getDoc(doc(member, 'leagues/security-league/events/event-a')));
  await assertFails(getDoc(doc(outsider, 'leagues/security-league')));
  await assertFails(getDoc(doc(outsider, 'leagues/security-league/events/event-a')));
  await assertFails(getDoc(doc(visitor, 'leagues/security-league')));
});
test('nenhum cliente pode alterar finanças, participantes ou o histórico', async () => {
  const member = environment.authenticatedContext('trainer-a').firestore();
  await assertFails(updateDoc(doc(member, 'leagues/security-league'), { balance: 999999999 }));
  await assertFails(
    updateDoc(doc(member, 'leagues/security-league'), { participantIds: ['trainer-b'] }),
  );
  await assertFails(
    setDoc(doc(member, 'leagues/security-league/events/hacked'), { message: 'Compra falsa' }),
  );
  await assertFails(setDoc(doc(member, 'leagues/new-league'), { participantIds: ['trainer-a'] }));
});
test('vínculos de ligas são privados e exclusivos do servidor', async () => {
  const member = environment.authenticatedContext('trainer-a').firestore();
  const outsider = environment.authenticatedContext('trainer-b').firestore();
  await assertSucceeds(getDoc(doc(member, 'memberships/trainer-a')));
  await assertFails(getDoc(doc(outsider, 'memberships/trainer-a')));
  await assertFails(updateDoc(doc(member, 'memberships/trainer-a'), { offline: 'other' }));
});
