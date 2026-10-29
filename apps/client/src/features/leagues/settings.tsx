import { CoachAvatar } from '../../ui/coach-profile';
import { defaultCoach } from '../../ui/coach-profile-storage';
import { Icon } from '../../ui/icons';
import { PixelBadge } from '../../ui/pixel-badge';
import { Career } from './career';
import { Select, Option } from '../../ui/select';
import { useState } from 'react';
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
  const [copied, setCopied] = useState(false);
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
      {leaving && (
        <div className="modal-backdrop">
          <section
            className="panel invite-dialog career-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar saída"
          >
            <Icon name="shield" />
            <h2>Sair da liga?</h2>
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
                Sim, sair
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
          <span className="eyebrow">JOGUE COM SEUS AMIGOS</span>
          <h2>Convites para a liga</h2>
          <p>
            {state.mode === 'multiplayer'
              ? 'Gere o código e compartilhe com quem você quer na liga. A entrada pelo convite é imediata.'
              : 'Convites estão disponíveis nas ligas com amigos.'}
          </p>
          <button
            className="primary"
            disabled={!connected || state.mode !== 'multiplayer' || !state.inviteCode}
            onClick={() => {
              setGenerated(true);
              setCopied(false);
            }}
          >
            Gerar convite
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
                    .then(() => setCopied(true))
                    .catch(() =>
                      setError('Não foi possível copiar. Selecione e copie o código acima.'),
                    );
                }}
              >
                {copied ? 'Código copiado ✓' : 'Copiar convite'}
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
            <div className="league-member-row" key={p.userId}>
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
              <span>
                <strong>{p.coach?.name ?? (p.userId === userId ? 'Você' : 'Técnico')}</strong>
                <br />
                <a href={'#/trophies?club=' + p.clubId}>
                  {state.clubs.byId[p.clubId]?.name}
                </a> · {p.userId === state.administratorId ? 'Administrador' : 'Treinador'} ·{' '}
                {p.userId === userId ? 'Você' : ''}
                {admin && p.userId !== userId && (
                  <button
                    className="secondary"
                    disabled={working}
                    onClick={() => setKickTarget(p.userId)}
                  >
                    Expulsar
                  </button>
                )}
              </span>
              <span className={p.online ? 'league-presence online' : 'league-presence'}>
                {p.online ? 'Online' : 'Offline'}
              </span>
            </div>
          ))}
          {admin &&
            Object.entries(state.returningClubs ?? {}).map(([owner, clubId]) => (
              <p key={owner}>
                {state.clubs.byId[clubId]?.name} · Retorno reservado{' '}
                <button
                  className="secondary"
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
                <h2>Expulsar treinador?</h2>
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
            </>
          )}
        </section>
      )}
      {state.mode === 'multiplayer' && (
        <section className="panel management-leave">
          <h2>Gerenciar carreira</h2>
          {state.mode === 'multiplayer' && (
            <button disabled={working || !connected} onClick={() => setLeaving(true)}>
              Abandonar liga online
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
  const requestedClub = new URLSearchParams(location.hash.split('?')[1]).get('club');
  const inspectingClub = Boolean(requestedClub && state.clubs.byId[requestedClub]);
  const clubId = inspectingClub ? requestedClub! : club.id;
  return (
    <TrophyGalleryContent
      key={`${clubId}:${inspectingClub}`}
      {...props}
      clubId={clubId}
      inspectingClub={inspectingClub}
    />
  );
}
function TrophyGalleryContent({
  clubId,
  inspectingClub,
  ...props
}: ViewProps & { clubId: string; inspectingClub: boolean }) {
  const { snapshot, club } = props;
  const { state } = snapshot;
  const [clubView, setClubView] = useState<
    'career' | 'trophies' | 'squad' | 'stadium' | 'training'
  >(inspectingClub ? 'squad' : 'career');
  const [visitedViews, setVisitedViews] = useState<string[]>(['squad']);
  const selected = state.clubs.byId[clubId];
  const trophies = state.trophies.filter((t) => t.clubId === clubId);
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
                ['career', 'Carreira'],
                ['trophies', 'Troféus'],
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
                      trophies: 'trophy',
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
        {(!inspectingClub || clubView === 'career') && (
          <Career {...props} club={selected ?? club} />
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
        {(!inspectingClub || clubView === 'trophies' || clubView === 'career') && (
          <>
            <div className="trophy-gallery">
              {trophies.map((t) => {
                const rule = COMPETITIONS.find((c) => c.id === t.competitionId);
                const continental =
                  t.competitionId === 'libertadores' || t.competitionId === 'sul-americana';
                const league = rule?.format === 'league';
                return (
                  <article className="panel trophy-card" key={`${t.season}:${t.competitionId}`}>
                    <svg
                      width="150"
                      height="180"
                      viewBox="0 0 120 160"
                      role="img"
                      aria-label={`Troféu ${rule?.name ?? t.competitionId}`}
                    >
                      <defs>
                        <linearGradient id={`gold-${t.competitionId}`}>
                          <stop stopColor="#977233" />
                          <stop offset=".5" stopColor="#ffe3a0" />
                          <stop offset="1" stopColor="#b4873e" />
                        </linearGradient>
                      </defs>
                      <g fill={`url(#gold-${t.competitionId})`} stroke="#b48635" strokeWidth="3">
                        {league ? (
                          <>
                            <path d="M35 25h50l-8 65H43z" />
                            <path d="M25 20h70v15H25z" />
                          </>
                        ) : continental ? (
                          <>
                            <circle cx="60" cy="30" r="20" />
                            <path d="M49 50h22l8 60H41z" />
                          </>
                        ) : (
                          <>
                            <path d="M30 20h60l-6 45q-24 40-48 0z" />
                            <path
                              d="M30 30H12q0 48 28 40M90 30h18q0 48-28 40"
                              fill="none"
                              strokeWidth="7"
                            />
                          </>
                        )}
                        <path d="M53 85h14v35H53zM30 120h60v12H30z" />
                      </g>
                      <rect x="23" y="132" width="74" height="17" rx="3" fill="#233f38" />
                    </svg>
                    <h2>{rule?.name ?? t.competitionId}</h2>
                    <p>Campeão · {t.season}</p>
                  </article>
                );
              })}
            </div>
            {!trophies.length && (
              <section className="panel empty-state">
                As conquistas deste clube aparecerão aqui ao término de cada campeonato.
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
