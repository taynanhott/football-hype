import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { clubKit, commandSchema, type GameCommand } from '@football/shared';
import { executeCommand, temporaryModifiers, renewalTerms } from '@football/domain';
import type { ViewProps } from '../../ui/view-props';
import { useGameStore } from '../../store/game-store';

import { positionLabel } from '../../ui/position-label';
import { PlayerCard } from './player-card';
import { PlayerManagement } from './player-management';
import { SquadAssistant } from './squad-assistant';
import { PlayerModal } from './player-modal';
import { Select, Option } from '../../ui/select';

const mobileQuery = '(max-width: 760px)';
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches;
const subscribeMobile = (change: () => void) => {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
};
const mobileActions = [
  { id: 'policy', label: 'Transferências' },
  { id: 'effects', label: 'Bônus e penalidades' },
  { id: 'renew', label: 'Renegociação' },
] as const;

type Settings = Extract<GameCommand, { type: 'club-settings' }>['commands'];
type Notebook = { commands: Settings; requestId?: string };
const empty = (): Notebook => ({ commands: [] });
export function SquadPlanning({ snapshot, club }: ViewProps) {
  const key = `football.squad-notebook.${snapshot.state.id}.${club.id}`;
  const [notebook, setNotebook] = useState<Notebook>(empty);
  const [message, setMessage] = useState(
    'Vamos cuidar do elenco, professor. Escolha as ações nos jogadores e eu anoto tudo por aqui.',
  );
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('ALL');
  const mobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, () => false);
  const [mobileAction, setMobileAction] = useState<{
    playerId: string;
    section: 'effects' | 'policy' | 'renew';
  } | null>(null);
  const userId = useGameStore((s) => s.userId);
  const connected = useGameStore((s) => s.connected);
  const pending = useGameStore((s) => s.pendingActions);
  const busy = useGameStore((s) => s.busy);
  const locked = Boolean(notebook.requestId);
  useEffect(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* Old drafts are discarded. */
    }
  }, [key]);
  useEffect(() => {
    if (!notebook.requestId) return;
    let active = true;
    const check = (current: ReturnType<typeof useGameStore.getState>) => {
      if (!active) return;
      if (current.snapshot?.ledger.some((event) => event.id === notebook.requestId)) {
        setNotebook(empty());
        setMessage(
          'Tudo certo, professor. Coloquei nosso planejamento em prática. Podemos preparar os próximos passos.',
        );
      } else if (current.error && current.connected && current.pendingActions === 0) {
        setNotebook((previous) => ({ commands: previous.commands }));
        setMessage(
          `Precisamos rever um ponto antes de seguir: ${current.error} Suas anotações continuam aqui.`,
        );
      }
    };
    const unsubscribe = useGameStore.subscribe(check);
    queueMicrotask(() => check(useGameStore.getState()));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [notebook.requestId]);
  const policies = useMemo(
    () =>
      Object.fromEntries(
        notebook.commands.flatMap((c) =>
          c.type === 'management' && c.action === 'policy' && c.playerId
            ? [
                [
                  c.playerId,
                  {
                    available: c.available ?? false,
                    rivals: c.rivals ?? false,
                    interest: c.interest ?? 35,
                  },
                ],
              ]
            : [],
        ),
      ),
    [notebook.commands],
  );
  const preview = {
    ...snapshot,
    state: {
      ...snapshot.state,
      management: {
        ...snapshot.state.management,
        policies: { ...snapshot.state.management?.policies, ...policies },
      },
    },
  };
  const players = club.playerIds
    .flatMap((id) => (snapshot.state.players.byId[id] ? [snapshot.state.players.byId[id]!] : []))
    .filter(
      (p) =>
        (position === 'ALL' || p.position === position) &&
        p.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')),
    );
  function annotate(command: GameCommand) {
    if (locked || command.type !== 'management') return;
    const commands = notebook.commands.filter(
      (c) =>
        !(
          c.type === 'management' &&
          c.playerId === command.playerId &&
          (c.action === 'policy') === (command.action === 'policy')
        ),
    );
    const parsed = commandSchema.safeParse({
      type: 'club-settings',
      commands: [...commands, command],
    });
    if (!parsed.success || parsed.data.type !== 'club-settings') {
      setMessage(
        'Minha prancheta chegou ao limite de 50 ações. Vamos colocar este planejamento em prática primeiro.',
      );
      return;
    }
    const result = executeCommand(
      snapshot.state,
      parsed.data,
      userId,
      Date.now() + useGameStore.getState().clockOffset,
      crypto.randomUUID(),
    );
    if (!result.ok) {
      setMessage(`Antes de anotar, precisamos ajustar um detalhe: ${result.error.message}`);
      return;
    }
    setNotebook({ commands: parsed.data.commands });
    const name = snapshot.state.players.byId[command.playerId ?? '']?.name ?? 'o jogador';
    setMessage(
      command.action === 'renew'
        ? `Entendido! Anotei a renovação de ${name}. Deseja mais alguma coisa ou posso colocar o planejamento em prática?`
        : `Combinado, professor. Anotei esse ajuste para ${name}. Quer preparar mais alguma coisa?`,
    );
  }
  function commit() {
    if (locked || !connected || pending || busy || !notebook.commands.length) return;
    const requestId = useGameStore
      .getState()
      .send({ type: 'club-settings', commands: notebook.commands });
    if (requestId) {
      setNotebook((previous) => ({ ...previous, requestId }));
      setMessage(
        'Pode deixar comigo. Estou colocando nosso planejamento em prática e aguardando a confirmação do clube.',
      );
    } else
      setMessage(
        useGameStore.getState().error ??
          'Ainda não consegui falar com o clube. Suas anotações estão guardadas aqui.',
      );
  }
  return (
    <div className="squad-office">
      <aside className="squad-notebook" aria-label="Auxiliar e planejamento do elenco">
        <div className="assistant-name">
          <span aria-hidden="true">⚽</span>
          <strong>Seu auxiliar técnico</strong>
          <span className="assistant-local">Prancheta do elenco</span>
        </div>
        <div className="assistant-speech" role="status" aria-live="polite">
          {message}
        </div>
        <SquadAssistant writing={notebook.commands.length > 0} />
        <div className="notebook-buttons">
          <button
            type="button"
            className="primary"
            disabled={locked || !connected || busy || pending > 0 || !notebook.commands.length}
            onClick={commit}
          >
            {locked ? 'Colocando em prática…' : 'Pode colocar em prática'}
          </button>
        </div>
        {!connected && (
          <p className="notebook-connection">
            Sem conexão com o clube. Você pode continuar anotando.
          </p>
        )}
        {locked && !connected && (
          <p>Reconecte à liga para conferir a confirmação. Não vou repetir o envio.</p>
        )}
      </aside>
      <section className="squad-office-roster" aria-label="Jogadores do elenco">
        <div className="squad-office-controls">
          <label>
            Buscar no elenco
            <input
              type="search"
              placeholder="Nome do jogador"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Posição
            <Select value={position} onValueChange={setPosition} aria-label="Posição">
              <Option value="ALL">Todas</Option>
              {[
                'GK',
                'CB',
                'RB',
                'LB',
                'RWB',
                'LWB',
                'DM',
                'CM',
                'RM',
                'LM',
                'AM',
                'RW',
                'LW',
                'SS',
                'ST',
              ]
                .filter((p) =>
                  club.playerIds.some((id) => snapshot.state.players.byId[id]?.position === p),
                )
                .map((p) => (
                  <Option key={p} value={p}>
                    {positionLabel(p)}
                  </Option>
                ))}
            </Select>
          </label>
        </div>
        <div className="squad-office-players">
          {players.map((player) => (
            <article className="squad-office-player" key={player.id}>
              <div className="squad-office-card">
                <PlayerCard player={player} clubName={club.name} kit={clubKit(club)} />
                {notebook.commands.some(
                  (c) => c.type === 'management' && c.playerId === player.id,
                ) && <span className="squad-planned-badge">Anotado na prancheta</span>}
              </div>
              <div className="squad-office-actions">
                {mobile ? (
                  <div
                    className="squad-mobile-action-buttons"
                    aria-label={`Ações de ${player.name}`}
                  >
                    {mobileActions.map((action) => (
                      <button
                        type="button"
                        key={action.id}
                        disabled={
                          locked ||
                          (action.id === 'effects' &&
                            !temporaryModifiers(preview.state, player).length) ||
                          (action.id === 'renew' &&
                            Boolean(renewalTerms(preview.state, player).reason))
                        }
                        aria-haspopup="dialog"
                        onClick={() => setMobileAction({ playerId: player.id, section: action.id })}
                      >
                        {action.label}
                        {action.id === 'policy' &&
                          snapshot.state.management?.offers?.some(
                            (offer) =>
                              offer.playerId === player.id &&
                              offer.sellerId === club.id &&
                              offer.status === 'pending',
                          ) && (
                            <span
                              className="transfer-alert-dot"
                              aria-label="Proposta recebida para este jogador"
                            />
                          )}
                        <svg
                          viewBox="0 0 24 24"
                          width="26"
                          height="26"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          aria-hidden="true"
                        >
                          {action.id === 'effects' ? (
                            <>
                              <path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z" />
                              <path d="m8 12 3 3 5-6" />
                            </>
                          ) : action.id === 'policy' ? (
                            <path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4" />
                          ) : (
                            <>
                              <path d="M5 3h10l4 4v14H5ZM14 3v5h5M8 12h8M8 16h6" />
                            </>
                          )}
                        </svg>
                      </button>
                    ))}
                  </div>
                ) : (
                  <PlayerManagement
                    player={player}
                    snapshot={preview}
                    onPlan={annotate}
                    planningBusy={locked}
                  />
                )}
              </div>
            </article>
          ))}
        </div>
        {!players.length && (
          <p className="squad-office-empty">Nenhum jogador encontrado com esses filtros.</p>
        )}
      </section>
      {mobile && mobileAction && preview.state.players.byId[mobileAction.playerId] && (
        <PlayerModal
          className="squad-action-modal"
          hideClose
          title={`${mobileActions.find((action) => action.id === mobileAction.section)!.label} · ${preview.state.players.byId[mobileAction.playerId]!.name}`}
          onClose={() => setMobileAction(null)}
        >
          <PlayerManagement
            key={`${mobileAction.playerId}.${mobileAction.section}`}
            player={preview.state.players.byId[mobileAction.playerId]!}
            snapshot={preview}
            onPlan={annotate}
            planningBusy={locked}
            initialSection={mobileAction.section}
            hideTabs
          />

          <button type="button" className="primary" onClick={() => setMobileAction(null)}>
            Voltar ao elenco
          </button>
        </PlayerModal>
      )}
    </div>
  );
}
