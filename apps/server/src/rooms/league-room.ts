import { Room, ServerError, type Client } from '@colyseus/core';
import { connectOptionsSchema, type GameSnapshot } from '@football/shared';
import { z } from 'zod';
import { authenticate, type Identity } from '../auth/identity.js';
import type { LeagueService } from '../application/league-service.js';

export function leagueRoom(service: LeagueService): new () => Room {
  return class LeagueRoom extends Room {
    private leagueId = '';
    private unsubscribe: (() => void) | undefined;
    private readonly identities = new Map<string, Identity>();
    private readonly sent = new Map<string, GameSnapshot>();
    private readonly sending = new Map<string, Promise<void>>();
    override async onCreate(input: unknown): Promise<void> {
      const options = connectOptionsSchema.parse(input);
      if (!options.leagueId) throw new ServerError(400, 'Informe o código da liga');
      this.leagueId = options.leagueId;
      this.maxClients = 100;
      await this.setMetadata({ leagueId: this.leagueId });
      this.onMessage('heartbeat', async (client) => {
        const identity = this.identities.get(client.sessionId);
        if (!identity) return;
        try {
          await service.touch(this.leagueId, identity.userId);
        } catch {
          client.leave();
        }
      });
      this.onMessage('sync', (client) => {
        void this.sendSnapshot(client, true);
      });
      this.onMessage('command', async (client, input: unknown) => {
        let requestId: string | undefined;
        try {
          const envelope = z.object({ requestId: z.uuid(), command: z.unknown() }).safeParse(input);
          if (envelope.success) requestId = envelope.data.requestId;
          const identity = this.identities.get(client.sessionId);
          if (!identity) throw new Error('Acesso negado');
          const revision = await service.command(
            this.leagueId,
            identity.userId,
            envelope.success ? envelope.data.command : input,
            false,
            requestId,
          );
          client.send('ack', { ok: true, revision, ...(requestId ? { requestId } : {}) });
        } catch (error) {
          client.send('error', {
            message: error instanceof Error ? error.message : 'Falha inesperada',
            ...(requestId ? { requestId } : {}),
          });
        }
      });
      this.unsubscribe = service.updates.subscribe((id) => {
        if (id === this.leagueId) for (const client of this.clients) void this.sendSnapshot(client);
      });
    }
    override async onAuth(_client: Client, input: unknown): Promise<Identity> {
      try {
        return await authenticate(input);
      } catch {
        throw new ServerError(401, 'Não foi possível autenticar sua sessão');
      }
    }
    override async onJoin(client: Client, input: unknown, identity: Identity): Promise<void> {
      const options = connectOptionsSchema.parse(input);
      await service.join(this.leagueId, identity, options.clubId);
      this.identities.set(client.sessionId, identity);
      await this.sendSnapshot(client);
    }
    override onLeave(client: Client): void {
      this.identities.delete(client.sessionId);
      this.sent.delete(client.sessionId);
    }
    override onDispose(): void {
      this.unsubscribe?.();
    }
    private async sendSnapshot(client: Client, full = false): Promise<void> {
      const previous = this.sending.get(client.sessionId) ?? Promise.resolve();
      const sending = previous
        .catch(() => undefined)
        .then(() => this.deliverSnapshot(client, full));
      this.sending.set(client.sessionId, sending);
      try {
        await sending;
      } finally {
        if (this.sending.get(client.sessionId) === sending) this.sending.delete(client.sessionId);
      }
    }
    private async deliverSnapshot(client: Client, full: boolean): Promise<void> {
      try {
        const identity = this.identities.get(client.sessionId);
        if (!identity) return;
        const snapshot = await service.snapshot(this.leagueId, identity.userId, this.roomId);
        if (!this.identities.has(client.sessionId)) return;
        const previous = this.sent.get(client.sessionId);
        if (!full && previous) {
          const patch = Object.fromEntries(
            Object.entries(snapshot.state).filter(
              ([key, value]) => previous.state[key as keyof typeof previous.state] !== value,
            ),
          );
          client.send('snapshot-update', {
            leagueId: this.leagueId,
            baseRevision: previous.state.revision,
            revision: snapshot.state.revision,
            patch,
            tables: snapshot.tables,
            ledger: snapshot.ledger,
            serverTime: snapshot.serverTime,
            roomId: snapshot.roomId,
          });
        } else client.send('snapshot', snapshot);
        this.sent.set(client.sessionId, snapshot);
      } catch {
        client.send('error', { message: 'Sua participação nesta liga terminou' });
        client.leave();
      }
    }
  };
}
