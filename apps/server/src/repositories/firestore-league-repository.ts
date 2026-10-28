import { randomUUID } from 'node:crypto';
import { gzip, gunzipSync } from 'node:zlib';
import { promisify } from 'node:util';
import {
  getFirestore,
  type Firestore,
  type DocumentReference,
  type DocumentSnapshot,
  type Transaction,
} from 'firebase-admin/firestore';
import {
  worldStateSchema,
  gameEventSchema,
  type GameEvent,
  type WorldState,
} from '@football/shared';
import { firebaseApp } from '../auth/identity.js';
import type { LeagueRepository, SavedLeague } from './league-repository.js';

// Keep individual documents below Firestore's limit as match histories grow.
const PART_SIZE = 600_000;
const compress = promisify(gzip);
async function pack(value: unknown, version: string) {
  const bytes = await compress(JSON.stringify(value));
  const parts: { id: string; payload: Buffer }[] = [];
  if (bytes.length > PART_SIZE)
    for (let i = 0; i < bytes.length; i += PART_SIZE)
      parts.push({ id: `${version}-${i / PART_SIZE}`, payload: bytes.subarray(i, i + PART_SIZE) });
  return {
    fields: {
      payload: parts.length ? Buffer.alloc(0) : bytes,
      partIds: parts.map((part) => part.id),
    },
    parts,
  };
}
function metadata(state: WorldState) {
  return {
    name: state.name,
    mode: state.mode,
    revision: state.revision,
    status: state.deletedAt ? 'deleted' : state.status,
    nextScheduledAt: state.nextScheduledAt,
    participantIds: state.participants.map((member) => member.userId),
  };
}
export class FirestoreLeagueRepository implements LeagueRepository {
  private readonly cache = new Map<string, SavedLeague>();
  constructor(private readonly db: Firestore = getFirestore(firebaseApp)) {}
  private async unpack(document: DocumentSnapshot, transaction?: Transaction): Promise<unknown> {
    const ids: unknown = document.get('partIds');
    let payload: unknown = document.get('payload');
    if (Array.isArray(ids) && ids.length) {
      if (!ids.every((id): id is string => typeof id === 'string' && /^[\w-]+$/.test(id)))
        throw new Error('Partes de snapshot inválidas');
      const refs = ids.map((id) => document.ref.collection('payloads').doc(id));
      const docs = transaction ? await transaction.getAll(...refs) : await this.db.getAll(...refs);
      payload = Buffer.concat(
        docs.map((doc) => {
          const part: unknown = doc.get('payload');
          if (!Buffer.isBuffer(part)) throw new Error('Parte de snapshot ausente');
          return part;
        }),
      );
    }
    if (!Buffer.isBuffer(payload)) throw new Error('Snapshot inválido');
    return JSON.parse(gunzipSync(payload).toString('utf8')) as unknown;
  }
  private async writeParts(ref: DocumentReference, packed: Awaited<ReturnType<typeof pack>>) {
    // Upload immutable chunks in bounded batches, then atomically publish their pointers.
    // A full season's trajectories can exceed the transaction request limit.
    for (let offset = 0; offset < packed.parts.length; offset += 8) {
      const batch = this.db.batch();
      for (const part of packed.parts.slice(offset, offset + 8))
        batch.set(ref.collection('payloads').doc(part.id), { payload: part.payload });
      await batch.commit();
    }
  }
  async load(id: string): Promise<SavedLeague | undefined> {
    const document = await this.db.doc(`leagues/${id}`).get();
    if (!document.exists) return undefined;
    const cached = this.cache.get(id);
    if (cached && cached.state.revision === document.get('revision')) return cached;
    const events = await document.ref
      .collection('events')
      .orderBy('sequence', 'desc')
      .limit(100)
      .get();
    const saved = {
      state: worldStateSchema.parse(await this.unpack(document)),
      events: await Promise.all(
        events.docs.reverse().map(async (event) => {
          const { payload: _payload, partIds: _parts, ...entry } = event.data();
          void _payload;
          void _parts;
          return gameEventSchema.parse({ ...entry, patch: await this.unpack(event) });
        }),
      ),
    };
    this.cache.set(id, saved);
    return saved;
  }
  async create(state: WorldState): Promise<void> {
    const packed = await pack(state, randomUUID());
    const ref = this.db.doc(`leagues/${state.id}`);
    await this.writeParts(ref, packed);
    await this.db.runTransaction(async (transaction) => {
      const membership = this.db.doc(`memberships/${state.administratorId}`);
      const current = await transaction.get(membership);
      if (current.get(state.mode)) throw new Error('Você já participa de uma liga deste modo');
      transaction.create(ref, { ...metadata(state), ...packed.fields });
      transaction.set(membership, { [state.mode]: state.id }, { merge: true });
    });
  }
  async append(
    id: string,
    expectedRevision: number,
    state: WorldState,
    event: GameEvent,
  ): Promise<void> {
    const { patch, ...entry } = event;
    const [packed, packedEvent] = await Promise.all([
      pack(state, randomUUID()),
      pack(patch, randomUUID()),
    ]);
    const ref = this.db.doc(`leagues/${id}`);
    const eventRef = ref.collection('events').doc(event.id);
    await Promise.all([this.writeParts(ref, packed), this.writeParts(eventRef, packedEvent)]);
    await this.db.runTransaction(async (transaction) => {
      const current = await transaction.get(ref);
      if (current.get('revision') !== expectedRevision)
        throw new Error('A liga mudou. Atualize e tente novamente');
      const previousIds = current.get('participantIds') as string[];
      const previous = { participants: previousIds.map((userId) => ({ userId })) };
      const newMembers = state.participants.filter(
        (member) => !previous.participants.some((item) => item.userId === member.userId),
      );
      const removed = previous.participants.filter(
        (old) => !state.participants.some((item) => item.userId === old.userId),
      );
      const removedRefs: DocumentReference[] = [];
      for (const member of newMembers) {
        const membership = await transaction.get(this.db.doc(`memberships/${member.userId}`));
        if (membership.get(state.mode) && membership.get(state.mode) !== id)
          throw new Error('Você já participa de uma liga deste modo');
      }
      for (const member of removed) {
        const membership = await transaction.get(this.db.doc(`memberships/${member.userId}`));
        if (membership.get(state.mode) === id) removedRefs.push(membership.ref);
      }
      transaction.set(ref, { ...metadata(state), ...packed.fields });
      for (const member of newMembers)
        transaction.set(
          this.db.doc(`memberships/${member.userId}`),
          { [state.mode]: id },
          { merge: true },
        );
      for (const membership of removedRefs)
        transaction.set(membership, { [state.mode]: null }, { merge: true });
      transaction.create(eventRef, { ...entry, ...packedEvent.fields });
    });
    const cached = this.cache.get(id);
    if (cached?.state.revision === expectedRevision)
      this.cache.set(id, { state, events: [...cached.events, event].slice(-100) });
  }
  async forUser(userId: string): Promise<readonly WorldState[]> {
    const membership = await this.db.doc(`memberships/${userId}`).get();
    const ids = [membership.get('offline'), membership.get('multiplayer')].filter(
      (id): id is string => typeof id === 'string',
    );
    const states = await Promise.all(ids.map((id) => this.load(id)));
    return states.flatMap((saved) => (saved && !saved.state.deletedAt ? [saved.state] : []));
  }
  async active(): Promise<readonly string[]> {
    const docs = await this.db.collection('leagues').where('status', '==', 'active').get();
    return docs.docs.filter((doc) => doc.get('status') !== 'deleted').map((doc) => doc.id);
  }
  async due(now: number): Promise<readonly string[]> {
    const documents = await this.db
      .collection('leagues')
      .where('status', '==', 'active')
      .where('mode', 'in', ['offline', 'multiplayer'])
      .where('nextScheduledAt', '<=', now)
      .limit(100)
      .get();
    return documents.docs.map((document) => document.id);
  }
}
