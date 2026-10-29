import { applyEvent, executeCommand } from '@football/domain';
import type { GameCommand, GameSnapshot } from '@football/shared';

export type PendingAction = {
  id: string;
  command: GameCommand;
  at: number;
  sent: boolean;
  revision?: number;
};
export type QueueView = { snapshot: GameSnapshot; pendingActions: number; busy: boolean };
const barrier = (command: GameCommand) =>
  command.type === 'advance' || command.type === 'new-season';

/** One ordered writer; the screen is a projection of confirmed state plus pending actions. */
export class ActionQueue {
  private confirmed: GameSnapshot | undefined;
  private actions: PendingAction[];
  private active: PendingAction | undefined;
  private stopped = false;
  constructor(
    private readonly userId: string,
    private readonly send: (id: string, command: GameCommand) => void,
    private readonly change: (view: QueueView) => void,
    private readonly error: (message: string) => void,
    initial: PendingAction[] = [],
    private readonly checkpoint: (actions: readonly PendingAction[]) => void = () => undefined,
  ) {
    this.actions = initial;
  }
  accept(snapshot: GameSnapshot) {
    if (this.confirmed && snapshot.state.revision < this.confirmed.state.revision) return;
    this.confirmed = snapshot;
    const recovered =
      this.stopped &&
      this.actions.some((action) => snapshot.ledger.some((event) => event.id === action.id));
    if (recovered) {
      this.stopped = false;
      this.actions = this.actions.filter(
        (action) => !snapshot.ledger.some((event) => event.id === action.id),
      );
    }
    this.complete();
    this.publish();
    this.pump();
    return recovered;
  }
  enqueue(command: GameCommand, id: string, at: number) {
    if (!this.confirmed || this.stopped) throw new Error('Reconecte à liga para sincronizar');
    if (this.actions.some((action) => barrier(action.command)))
      throw new Error('Aguarde a atualização da rodada');
    if (this.actions.length >= 50) throw new Error('Aguarde a sincronização das ações pendentes');
    // Reject invalid actions immediately using the data already on the player's machine.
    const current = this.project();
    if (!barrier(command)) {
      const result = executeCommand(current.state, command, this.userId, at, id);
      if (!result.ok) throw new Error(result.error.message);
    }
    this.actions.push({ id, command, at, sent: false });
    this.publish();
    this.pump();
  }
  acknowledge(id: string, revision: number) {
    const recovered = this.stopped;
    if (recovered) {
      const action = this.actions.find((action) => action.id === id && action.sent);
      if (!action) return false;
      this.stopped = false;
      this.active = action;
    }
    if (this.active?.id !== id) return false;
    this.active.revision = revision;
    this.complete();
    this.publish();
    this.pump();
    return recovered;
  }
  get waitingForSnapshot() {
    return this.active?.revision !== undefined;
  }
  reject(id: string, message: string) {
    if (this.active?.id !== id) return;
    this.actions = this.actions.filter((action) => action.id !== id);
    this.active = undefined;
    this.error(message);
    this.publish();
    this.pump();
  }
  stop(message?: string) {
    this.stopped = true;
    this.active = undefined;
    if (message) this.error(message);
    this.publish();
  }
  private complete() {
    if (
      this.active?.revision === undefined ||
      !this.confirmed ||
      this.confirmed.state.revision < this.active.revision
    )
      return;
    this.actions = this.actions.filter((action) => action !== this.active);
    this.active = undefined;
  }
  private project(): GameSnapshot {
    const confirmed = this.confirmed!;
    if (this.stopped) return confirmed;
    let state = confirmed.state;
    const kept: PendingAction[] = [];
    for (const action of this.actions) {
      if (action.revision !== undefined && action.revision <= confirmed.state.revision) {
        kept.push(action);
        continue;
      }
      // A snapshot may arrive before its acknowledgement. The event id proves it was applied.
      if (confirmed.ledger.some((event) => event.id === action.id) || barrier(action.command)) {
        kept.push(action);
        continue;
      }
      const event = executeCommand(state, action.command, this.userId, action.at, action.id);
      if (event.ok) {
        const applied = applyEvent(state, event.value);
        if (applied.ok) state = applied.value;
        kept.push(action);
      } else if (action.sent) {
        kept.push(action);
      } else {
        this.error(event.error.message);
      }
    }
    this.actions = kept;
    return { ...confirmed, state };
  }
  private publish() {
    if (!this.confirmed) return;
    const snapshot = this.project();
    this.checkpoint(this.actions);
    this.change({
      snapshot,
      pendingActions: this.actions.length,
      busy: this.stopped || this.actions.some((action) => barrier(action.command)),
    });
  }
  private pump() {
    if (this.stopped || this.active || !this.confirmed) return;
    const next = this.actions[0];
    if (!next) return;
    next.sent = true;
    this.active = next;
    this.checkpoint(this.actions);
    try {
      this.send(next.id, next.command);
    } catch {
      this.stop('A conexão foi interrompida. Reconecte para sincronizar as ações pendentes.');
    }
  }
}
