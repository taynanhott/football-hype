import { Icon } from '../../ui/icons';
import { PixelBadge } from '../../ui/pixel-badge';
import { Career } from './career';
import { Select, Option } from '../../ui/select';
import { useState, useEffect } from 'react';
import { ClubInspection } from '../clubs/club-inspection';
import { COMPETITIONS } from '@football/shared';
import type { ViewProps } from '../../ui/view-props';
import { useGameStore } from '../../store/game-store';
import { request } from './api';
import { dateTime } from '../../ui/format';
export function LeagueSettings({ snapshot }: ViewProps) {
  const { state } = snapshot;
  const { userId, send, busy, disconnect, connected } = useGameStore();
  const [error, setError] = useState('');
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'invites' | 'rounds'>('invites');
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);
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
      <div className="segmented management-tabs" role="group" aria-label="Áreas de gerenciamento">
        <button
          className={tab === 'invites' ? 'selected' : ''}
          aria-pressed={tab === 'invites'}
          onClick={() => setTab('invites')}
        >
          Convites
        </button>
        {admin && (
          <button
            className={tab === 'rounds' ? 'selected' : ''}
            aria-pressed={tab === 'rounds'}
            onClick={() => setTab('rounds')}
          >
            Rodadas
          </button>
        )}
      </div>
      {tab === 'invites' && (
        <section className="panel management-invites">
          <span className="eyebrow">JOGUE COM SEUS AMIGOS</span>
          <h2>Convites para a liga</h2>
          <p>
            {state.mode === 'multiplayer'
              ? 'Gere o código e compartilhe com quem você quer na liga. O administrador aprova as solicitações de entrada.'
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
      {admin && tab === 'rounds' && (
        <section className="panel management-rounds">
          <span className="eyebrow">CONTROLE DO ADMINISTRADOR</span>
          <h2>Rodadas da liga</h2>
          <p>Próxima rodada: {dateTime(state.nextScheduledAt)}</p>
          <button
            className="primary"
            disabled={busy || !connected}
            onClick={() => send({ type: state.status === 'active' ? 'advance' : 'new-season' })}
          >
            {busy
              ? 'Processando…'
              : state.status === 'active'
                ? 'Avançar rodada'
                : 'Iniciar nova temporada'}
          </button>
        </section>
      )}
      {admin && tab === 'invites' && state.mode === 'multiplayer' && (
        <section className="panel">
          <h2>Participantes e bots</h2>
          <p>
            A vaga fica vinculada à sua conta. Após 48 horas sem acessar a liga, ou ao sair da conta
            ou abandonar a liga, um bot assume o clube e a vaga é liberada.
          </p>
          {state.participants.map((p) => (
            <p key={p.userId}>
              <a href={'#/trophies?club=' + p.clubId}>{state.clubs.byId[p.clubId]?.name}</a> ·{' '}
              {p.userId === state.administratorId ? 'Administrador' : 'Treinador'} ·{' '}
              {p.userId === userId ? 'Você' : p.userId.slice(0, 8)}
            </p>
          ))}
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
              <h2>Solicitações de entrada</h2>
              {!state.requests.length && <p>Nenhuma solicitação pendente.</p>}
              {state.requests.map((r) => (
                <div className="admission-row" key={r.userId}>
                  <p>
                    Treinador {r.userId.slice(0, 8)} · Solicitou{' '}
                    {state.clubs.byId[r.clubId ?? '']?.name ?? 'sorteio'}
                  </p>
                  {state.admission.assignment === 'chosen' && (
                    <Select
                      aria-label={`Clube para ${r.userId}`}
                      value={chosen[r.userId] ?? r.clubId ?? ''}
                      onValueChange={(value) => setChosen({ ...chosen, [r.userId]: value })}
                    >
                      <Option value="">Escolha um clube</Option>
                      {state.clubs.ids
                        .filter((id) => {
                          const c = state.clubs.byId[id];
                          return (
                            c?.country === 'BR' &&
                            (!state.admission.division ||
                              c.division === state.admission.division) &&
                            !state.participants.some((p) => p.clubId === id)
                          );
                        })
                        .map((id) => (
                          <Option key={id} value={id}>
                            {state.clubs.byId[id]?.name}
                          </Option>
                        ))}
                    </Select>
                  )}
                  <button
                    onClick={() =>
                      void action('decide', {
                        userId: r.userId,
                        approve: true,
                        ...((chosen[r.userId] ?? r.clubId)
                          ? { clubId: chosen[r.userId] ?? r.clubId }
                          : {}),
                      })
                    }
                  >
                    Aprovar entrada
                  </button>
                  <button
                    onClick={() => void action('decide', { userId: r.userId, approve: false })}
                  >
                    Recusar
                  </button>
                </div>
              ))}
            </>
          )}
        </section>
      )}
      {!admin && state.mode === 'multiplayer' && (
        <section className="panel management-leave">
          <h2>Gerenciar carreira</h2>
          {state.mode === 'multiplayer' && (
            <button
              disabled={working || !connected}
              onClick={() => {
                if (confirm('Abandonar a liga e liberar sua vaga para outro treinador?'))
                  void action('leave');
              }}
            >
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
  const [clubView, setClubView] = useState<
    'career' | 'trophies' | 'squad' | 'stadium' | 'training'
  >(inspectingClub ? 'squad' : 'career');
  useEffect(() => {
    setClubView(inspectingClub ? 'squad' : 'career');
  }, [clubId, inspectingClub]);
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
