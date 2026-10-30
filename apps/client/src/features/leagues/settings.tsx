import { CompetitionTrophy } from '../../ui/competition-trophy';
import { CoachAvatar } from '../../ui/coach-profile';
import { defaultCoach } from '../../ui/coach-profile-storage';
import { Icon } from '../../ui/icons';
import { PixelBadge } from '../../ui/pixel-badge';
import { Career } from './career';
import { Select, Option } from '../../ui/select';
import { useEffect, useState } from 'react';
import { ClubInspection } from '../clubs/club-inspection';
import { COMPETITIONS } from '@football/shared';
import type { ViewProps } from '../../ui/view-props';
import { useGameStore } from '../../store/game-store';
import { request } from './api';
export function LeagueSettings({ snapshot }: ViewProps) {
  const { state } = snapshot;
  const { userId, send, busy, disconnect, connected } = useGameStore();
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(0);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(0), 3000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const [working, setWorking] = useState(false);
  const [kickTarget, setKickTarget] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const admin = userId === state.administratorId;
  async function action(kind: string, body?: unknown) {
    if (working) return;
    setWorking(true);
    try {
      setError('');
      await request(`/api/leagues/${state.id}/${kind}`, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (kind === 'leave' || kind === 'delete') disconnect();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao alterar liga');
    } finally {
      setWorking(false);
    }
  }
  return (
    <>
      {error && <p role="alert">{error}</p>}
      {copied > 0 && (
        <div className="invite-copy-toast" role="status" aria-live="polite" key={copied}>
          <Icon name="shield" size={20} />
          <span>Código copiado!</span>
        </div>
      )}
      {leaving && (
        <div className="modal-backdrop">
          <section
            className="panel invite-dialog career-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar saída"
          >
            <Icon name="shield" />
            <h2>Abandonar esta liga?</h2>
            <p>
              Se o administrador sair, outro participante será sorteado para assumir. Se ninguém
              restar, a liga será excluída.
            </p>
            <div className="career-confirm-actions">
              <button
                className="career-confirm-danger"
                disabled={working}
                onClick={() => {
                  setLeaving(false);
                  void action('leave');
                }}
              >
                Confirmar saída
              </button>
              <button className="secondary" onClick={() => setLeaving(false)}>
                Cancelar
              </button>
            </div>
          </section>
        </div>
      )}

      {state.mode === 'multiplayer' && (
        <section className="panel management-invites">
          <div className="invite-panel-copy">
            <span className="invite-panel-icon">
              <Icon name="connections" size={26} />
            </span>
            <div>
              <h2>Convide para sua liga</h2>
              <p>Compartilhe o código e traga seus amigos para a disputa.</p>
            </div>
          </div>
          <button
            className="primary"
            disabled={!connected || state.mode !== 'multiplayer' || !state.inviteCode}
            onClick={() => {
              setGenerated(true);
              setCopied(0);
            }}
          >
            <Icon name="kickoff" size={18} /> Gerar convite
          </button>
          {generated && state.inviteCode && (
            <div className="management-invite-code">
              <label>
                Código do convite
                <input
                  readOnly
                  value={`${state.id}:${state.inviteCode}`}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <button
                className="secondary"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(`${state.id}:${state.inviteCode}`)
                    .then(() => {
                      setError('');
                      setCopied((count) => count + 1);
                    })
                    .catch(() =>
                      setError('Não foi possível copiar. Selecione e copie o código acima.'),
                    );
                }}
              >
                Copiar convite
              </button>
            </div>
          )}
        </section>
      )}

      {state.mode === 'multiplayer' && (
        <section className="panel">
          <h2>Participantes e bots</h2>
          <p>
            Ao sair, o clube fica reservado para o retorno pelo convite. Expulsar libera o vínculo e
            permite escolher outro time.
          </p>
          {state.participants.map((p) => (
            <div
              className="league-member-row"
              key={p.userId}
              role="link"
              tabIndex={0}
              aria-label={'Ver carreira de ' + (p.coach?.name ?? 'Treinador')}
              onClick={(event) => {
                if (!(event.target as HTMLElement).closest('a, button'))
                  location.hash = '/trophies?trainer=' + encodeURIComponent(p.userId);
              }}
              onKeyDown={(event) => {
                if (event.target === event.currentTarget && event.key === 'Enter')
                  location.hash = '/trophies?trainer=' + encodeURIComponent(p.userId);
              }}
            >
              <PixelBadge
                name={state.clubs.byId[p.clubId]?.name ?? 'Clube'}
                {...(state.clubs.byId[p.clubId]?.crestUrl
                  ? { url: state.clubs.byId[p.clubId]!.crestUrl! }
                  : {})}
                size={36}
              />
              <CoachAvatar
                profile={{ ...defaultCoach, ...p.coach, name: p.coach?.name ?? 'Técnico' }}
              />
              <div className="league-member-info">
                <a
                  className="league-coach-link"
                  href={'#/trophies?trainer=' + encodeURIComponent(p.userId)}
                >
                  <strong>{p.coach?.name ?? (p.userId === userId ? 'Você' : 'Técnico')}</strong>
                </a>
                <br />
                <a className="league-member-club" href={'#/trophies?club=' + p.clubId}>
                  {state.clubs.byId[p.clubId]?.name}
                </a>{' '}
                · {p.userId === state.administratorId ? 'Administrador' : 'Treinador'}{' '}
                {p.userId === userId ? ' · Você' : ''}
              </div>
              <span className={p.online ? 'league-presence online' : 'league-presence'}>
                {p.online ? 'Online' : 'Offline'}
              </span>
              <div className="league-member-actions">
                {admin && p.userId !== userId && (
                  <button
                    className="league-kick-button"
                    disabled={working}
                    onClick={() => setKickTarget(p.userId)}
                  >
                    Expulsar
                  </button>
                )}
              </div>
            </div>
          ))}
          {admin &&
            Object.entries(state.returningClubs ?? {}).map(([owner, clubId]) => (
              <p key={owner}>
                {state.clubs.byId[clubId]?.name} · Retorno reservado{' '}
                <button
                  className="league-kick-button"
                  disabled={working}
                  onClick={() => setKickTarget(owner)}
                >
                  Expulsar e liberar vínculo
                </button>
              </p>
            ))}
          {kickTarget && (
            <div className="modal-backdrop">
              <section
                className="panel invite-dialog career-confirm-dialog"
                role="dialog"
                aria-modal="true"
                aria-label="Confirmar expulsão"
              >
                <h2>Expulsar participante da liga?</h2>
                <p>
                  <strong>
                    {state.participants.find((participant) => participant.userId === kickTarget)
                      ?.coach?.name ?? 'Participante'}
                  </strong>{' '}
                  ·{' '}
                  {
                    state.clubs.byId[
                      state.participants.find((participant) => participant.userId === kickTarget)
                        ?.clubId ??
                        state.returningClubs?.[kickTarget] ??
                        ''
                    ]?.name
                  }
                </p>
                <p>
                  O vínculo com o clube será liberado. Ao voltar pelo convite, ele poderá escolher
                  outro time.
                </p>
                <div className="career-confirm-actions">
                  <button
                    className="career-confirm-danger"
                    disabled={working}
                    onClick={() => {
                      void action('kick', { userId: kickTarget });
                      setKickTarget(null);
                    }}
                  >
                    Sim, expulsar
                  </button>
                  <button className="secondary" onClick={() => setKickTarget(null)}>
                    Cancelar
                  </button>
                </div>
              </section>
            </div>
          )}
          <p>
            {state.clubs.ids.filter((id) => state.clubs.byId[id]?.country === 'BR').length -
              state.participants.length}{' '}
            clubes controlados por bots
          </p>
          {admin && (
            <>
              <h2>Regras de admissão</h2>
              <div className="league-admission-fields">
                <label>
                  Divisão permitida
                  <Select
                    value={state.admission.division ?? ''}
                    disabled={busy}
                    onValueChange={(value) =>
                      send({
                        type: 'admission',
                        division: (value || null) as typeof state.admission.division,
                        assignment: state.admission.assignment,
                      })
                    }
                  >
                    <Option value="">Todas</Option>
                    {['A', 'B', 'C', 'D', 'REGIONAL'].map((d) => (
                      <Option key={d} value={d}>
                        {d}
                      </Option>
                    ))}
                  </Select>
                </label>
                <label>
                  Distribuição de clubes
                  <Select
                    value={state.admission.assignment}
                    disabled={busy}
                    onValueChange={(value) =>
                      send({
                        type: 'admission',
                        division: state.admission.division,
                        assignment: value as 'chosen' | 'random',
                      })
                    }
                  >
                    <Option value="chosen">Escolha de time na divisão permitida</Option>
                    <Option value="random">Sortear time na divisão permitida</Option>
                  </Select>
                </label>
              </div>
            </>
          )}
        </section>
      )}
      {state.mode === 'multiplayer' && (
        <section className="panel management-leave">
          <h2>Gerenciar carreira</h2>
          {state.mode === 'multiplayer' && (
            <button
              className="league-leave-button"
              disabled={working || !connected}
              onClick={() => setLeaving(true)}
            >
              <Icon name="logout" size={18} /> Abandonar liga online
            </button>
          )}
        </section>
      )}
    </>
  );
}
export function TrophyGallery(props: ViewProps) {
  const { snapshot, club } = props;
  const { state } = snapshot;
  const trainerId = new URLSearchParams(location.hash.split('?')[1]).get('trainer');
  const trainer = state.participants.find((member) => member.userId === trainerId);
  const requestedClub = new URLSearchParams(location.hash.split('?')[1]).get('club');
  const inspectingClub = Boolean(requestedClub && state.clubs.byId[requestedClub]);
  const clubId = inspectingClub ? requestedClub! : (trainer?.clubId ?? club.id);
  return (
    <TrophyGalleryContent
      key={`${clubId}:${inspectingClub}:${trainerId ?? ''}`}
      {...props}
      clubId={clubId}
      inspectingClub={inspectingClub}
      trainerId={trainer?.userId ?? useGameStore.getState().userId ?? ''}
    />
  );
}
function TrophyGalleryContent({
  clubId,
  inspectingClub,
  trainerId,
  ...props
}: ViewProps & { clubId: string; inspectingClub: boolean; trainerId: string }) {
  const { snapshot, club } = props;
  const { state } = snapshot;
  const [clubView, setClubView] = useState<'career' | 'squad' | 'stadium' | 'training'>(
    inspectingClub ? 'squad' : 'career',
  );
  const [visitedViews, setVisitedViews] = useState<string[]>(['squad']);
  const selected = state.clubs.byId[clubId];
  const trainer = state.participants.find((member) => member.userId === trainerId);
  const trophies = state.trophies.filter((t) =>
    inspectingClub ? t.clubId === clubId : t.coachUserId === trainerId,
  );
  const displayedTrophies = COMPETITIONS.filter((rule) => rule.id !== 'pre-libertadores').map(
    (rule) => ({ competitionId: rule.id, season: state.season }),
  );
  const stadium = state.stadiums.byId[selected?.stadiumId ?? ''];
  return (
    <>
      {inspectingClub && (
        <>
          <section className="club-profile-banner" aria-label="Perfil do clube">
            {selected && (
              <PixelBadge
                name={selected.name}
                {...(selected.crestUrl ? { url: selected.crestUrl } : {})}
                size={64}
              />
            )}
            <div className="club-profile-identity">
              <strong>{selected?.name}</strong>
              <span>{selected?.coachName ?? 'Treinador do clube'}</span>
            </div>
            <div className="club-profile-facts">
              <span>
                <Icon name="ball" size={18} /> Série {selected?.division}
              </span>
              <span>
                <Icon name="stadium" size={18} /> {stadium?.name}
              </span>
              <span>
                <Icon name="squad" size={18} />{' '}
                {stadium?.sectors
                  .reduce((sum, sector) => sum + sector.capacity, 0)
                  .toLocaleString('pt-BR')}{' '}
                lugares
              </span>
            </div>
          </section>
          <div className="segmented club-tabs" role="group" aria-label="Dados do clube">
            {(
              [
                ['squad', 'Elenco'],
                ['stadium', 'Estádio'],
                ['training', 'CT'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                aria-pressed={clubView === id}
                className={clubView === id ? 'selected' : ''}
                onClick={() => {
                  setVisitedViews((views) => (views.includes(id) ? views : [...views, id]));
                  setClubView(id);
                }}
              >
                <Icon
                  name={
                    {
                      career: 'tactics',
                      squad: 'squad',
                      stadium: 'stadium',
                      training: 'training',
                    }[id]
                  }
                  size={18}
                />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="club-tab-content">
        {!inspectingClub && (
          <>
            <section className="club-profile-banner trainer-profile-banner">
              <CoachAvatar
                profile={{
                  ...defaultCoach,
                  ...trainer?.coach,
                  name: trainer?.coach?.name ?? 'Treinador',
                }}
              />
              <div className="club-profile-identity">
                <strong>{trainer?.coach?.name ?? 'Treinador'}</strong>
                <span>Carreira do treinador · {selected?.name}</span>
              </div>
            </section>
            <Career {...props} club={selected ?? club} trainerId={trainerId} />
          </>
        )}
        {inspectingClub &&
          selected &&
          (['squad', 'stadium', 'training'] as const).map(
            (view) =>
              visitedViews.includes(view) && (
                <div key={clubId + view} hidden={clubView !== view}>
                  <ClubInspection state={state} club={selected} view={view} />
                </div>
              ),
          )}

        <div className="trophy-gallery trophy-gallery-compact">
          {displayedTrophies.map((t) => {
            const rule = COMPETITIONS.find((c) => c.id === t.competitionId);
            return (
              <article
                className="panel trophy-card"
                data-earned={trophies.some((item) => item.competitionId === t.competitionId)}
                key={`${t.season}:${t.competitionId}`}
              >
                <CompetitionTrophy
                  competitionId={t.competitionId}
                  name={rule?.name ?? t.competitionId}
                />
                <h2>
                  <b>{trophies.filter((item) => item.competitionId === t.competitionId).length}x</b>{' '}
                  {rule?.name ?? t.competitionId}
                </h2>
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}
