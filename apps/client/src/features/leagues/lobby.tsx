import { BrandMark } from '../../ui/brand-mark';
import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createLeague, firebaseEnabled, listLeagues, loadCatalog, request } from './api';
import { useGameStore } from '../../store/game-store';
import { Icon } from '../../ui/icons';
import { DivisionBadge, PixelBadge } from '../../ui/pixel-badge';
import { useSession } from '../auth/session';

export function Lobby() {
  const session = useSession();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function login() {
    setError('');
    setBusy(true);
    try {
      const firebase = await import('../auth/firebase');
      await firebase.googleLogin();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Não foi possível entrar';
      setError(
        message.includes('operation-not-allowed')
          ? 'Ative o provedor Google no Firebase Authentication.'
          : message.includes('unauthorized-domain')
            ? 'Autorize localhost nos domínios do Firebase Authentication.'
            : message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="lobby lobby-clubs">
      <header className="lobby-header">
        <a className="brand" href="#/">
          <BrandMark size={46} />
          <span>
            FOOTBALL HYPE<small>FOOTBALL MANAGER BRASIL</small>
          </span>
        </a>
        <span className="pill">TEMPORADA 2026</span>
      </header>
      {!session.user ? (
        <div className="login-welcome">
          <div className="stadium-art" aria-hidden="true">
            <svg className="access-lanyard" viewBox="0 0 420 500">
              <path
                className="lanyard-strap"
                d="M206 235C173 204 113 112 132 58C149 10 267 8 290 60C313 111 254 205 219 235"
              />
              <path
                className="lanyard-stitch"
                d="M206 235C173 204 113 112 132 58C149 10 267 8 290 60C313 111 254 205 219 235"
              />
            </svg>
            <div className="coach-access-badge">
              <span className="badge-metal-clip" />
              <div className="badge-brand">
                <BrandMark size={44} />
                <span>
                  FOOTBALL HYPE<small>CREDENCIAL OFICIAL</small>
                </span>
              </div>
              <div className="badge-coach-profile">
                <Icon name="squad" size={42} />
                <div>
                  <span>COMISSÃO TÉCNICA</span>
                  <strong>TREINADOR</strong>
                </div>
              </div>
              <div className="badge-permission">
                <span>ACESSO LIBERADO</span>
                <strong>Vestiário e área técnica</strong>
              </div>
              <div className="badge-bottom">
                <span className="badge-barcode" />
                <b>2026</b>
              </div>
            </div>
          </div>
          <div className="login-access">
            <div className="login-game-brand">
              <BrandMark size={144} />
              <strong>FOOTBALL HYPE</strong>
              <span>FOOTBALL MANAGER BRASIL</span>
            </div>
            <p className="login-football-copy">
              O vestiário te espera, professor.
              <br />
              Seu próximo título começa aqui.
            </p>
            <button
              className="primary google-login-button"
              disabled={busy || session.loading || !firebaseEnabled}
              onClick={() => void login()}
            >
              <svg className="google-login-symbol" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.4ZM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22ZM6.4 14a6 6 0 0 1 0-4V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14ZM12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.4L6.4 10c.8-2.3 3-4.1 5.6-4.1Z"
                />
              </svg>
              <span>{session.loading ? 'Conectando…' : busy ? 'Abrindo Google…' : 'Google'}</span>
            </button>
            {!firebaseEnabled && <p>Configure o Firebase para habilitar o acesso.</p>}
            {(error || session.error) && (
              <p className="form-error" role="alert">
                {error || session.error}
              </p>
            )}
          </div>
        </div>
      ) : (
        <AuthenticatedLobby user={session.user} />
      )}
    </div>
  );
}
function AuthenticatedLobby({ user }: { user: { uid: string; name: string } }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [landingStart, setLandingStart] = useState(0);
  const [reservation, setReservation] = useState<{
    leagueId: string;
    clubId: string;
    division: string;
  } | null>(null);
  const [boundLeague, setBoundLeague] = useState('');
  const binding = useRef(false);
  const [creating, setCreating] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [choice, setChoice] = useState<'chosen' | 'random'>('chosen');
  const [settling, setSettling] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [roll, setRoll] = useState<string[]>([]);
  const [rolled, setRolled] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    id: string;
    action: 'leave' | 'delete' | 'reset';
  } | null>(null);
  useEffect(() => {
    if (!spinning || !settling) return;
    const timer = window.setTimeout(() => {
      setSpinning(false);
      setRolled(true);
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [spinning, settling]);
  const [division, setDivision] = useState('A');
  const [mode, setMode] = useState<'offline' | 'multiplayer'>('offline');
  const [teamId, setTeamId] = useState('');
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');
  const [inviteClub, setInviteClub] = useState('');
  const [invitation, setInvitation] = useState<{
    assignment: 'chosen' | 'random';
    clubs: {
      id: string;
      name: string;
      division: string;
      occupied?: boolean | undefined;
      crestUrl?: string | undefined;
    }[];
  } | null>(null);
  const [error, setError] = useState('');
  const connect = useGameStore((state) => state.connect);
  const busy = useGameStore((state) => state.busy);
  const queryClient = useQueryClient();
  const catalog = useQuery({
    queryKey: ['club-catalog'],
    enabled: creating,
    queryFn: loadCatalog,
    staleTime: 60000,
    retry: false,
  });
  const leagues = useQuery({
    queryKey: ['leagues', user.uid],
    queryFn: listLeagues,
    retry: false,
    staleTime: 30000,
  });
  const teams = (catalog.data?.clubs ?? []).filter((club) => club.division === division);
  const selected = teams.find((club) => club.id === teamId) ?? teams[0];
  const soloFull = (leagues.data?.filter((league) => league.mode === 'offline').length ?? 0) >= 2;
  const multiplayerFull = leagues.data?.some((league) => league.mode === 'multiplayer') ?? false;
  const actionsUnavailable = busy || !leagues.isSuccess || leagues.isFetching;
  const existingMode =
    (leagues.data?.filter((league) => league.mode === mode).length ?? 0) >=
    (mode === 'offline' ? 2 : 1)
      ? leagues.data?.find((league) => league.mode === mode)
      : undefined;
  async function spin() {
    if (
      !teams.length ||
      spinning ||
      boundLeague ||
      reservation ||
      existingMode ||
      binding.current ||
      leagues.isPending ||
      leagues.isError
    )
      return;
    binding.current = true;
    setError('');
    setSettling(false);
    setRolled(false);
    setRoll(
      Array.from({ length: Math.max(85, teams.length * 4) }, (_, i) => teams[i % teams.length]!.id),
    );
    setSpinning(true);
    useGameStore.setState({ busy: true });
    try {
      const draw = z
        .object({ leagueId: z.uuid(), clubId: z.uuid(), division: z.string() })
        .parse(
          await request('/api/draw', { method: 'POST', body: JSON.stringify({ mode, division }) }),
        );
      const available = (catalog.data?.clubs ?? []).filter(
        (club) => club.division === draw.division,
      );
      if (!available.some((club) => club.id === draw.clubId))
        throw new Error('O clube reservado não está no catálogo. Atualize a página.');
      const transform = stripRef.current ? getComputedStyle(stripRef.current).transform : 'none';
      const offset = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41;
      setLandingStart(offset);
      setReservation(draw);
      setDivision(draw.division);
      const strip = Array.from({ length: 85 }, (_, i) => available[i % available.length]!.id);
      strip[60] = draw.clubId;
      setRoll(strip);
      setTeamId(draw.clubId);
      setSettling(true);
    } catch (reason) {
      setSpinning(false);
      setSettling(false);
      setRoll([]);
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível confirmar o sorteio. Tente novamente para recuperar o mesmo clube reservado.',
      );
    } finally {
      binding.current = false;
      useGameStore.setState({ busy: false });
    }
  }
  async function start() {
    if (!selected || spinning || binding.current) return;
    setError('');
    try {
      useGameStore.setState({ busy: true });
      const id =
        boundLeague ||
        existingMode?.id ||
        (await createLeague(
          `${selected.name} · ${mode === 'offline' ? 'Carreira' : 'Amigos'}`,
          mode,
          selected.id,
          'chosen',
        ));
      setBoundLeague(id);
      await connect(id);
      await queryClient.invalidateQueries({ queryKey: ['leagues', user.uid] });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar a liga');
      useGameStore.setState({ busy: false });
    }
  }
  async function manage(id: string, action: 'leave' | 'delete' | 'reset') {
    try {
      setConfirmation(null);
      await request(`/api/leagues/${id}/${action}`, { method: 'POST' });
      queryClient.setQueryData<Awaited<ReturnType<typeof listLeagues>>>(
        ['leagues', user.uid],
        (previous) =>
          action === 'reset' ? previous : previous?.filter((league) => league.id !== id),
      );
      void queryClient.invalidateQueries({ queryKey: ['leagues', user.uid] });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao alterar liga');
    }
  }
  async function logout() {
    try {
      const firebase = await import('../auth/firebase');
      await firebase.logout();
      queryClient.removeQueries({ queryKey: ['leagues'] });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível sair da conta');
    }
  }
  return (
    <main className={`club-selection ${creating ? 'manual-team-screen' : ''}`}>
      {
        <div className="career-toolbar">
          <span>
            <Icon name="shield" /> {user.name}
          </span>
          {creating || (joining && invitation) ? (
            <button
              className="secondary career-nav-button career-back-button"
              disabled={busy || spinning}
              onClick={() => {
                setCreating(false);
                setJoining(false);
                setInvitation(null);
              }}
            >
              <Icon name="back" size={18} /> Suas carreiras
            </button>
          ) : (
            <button
              className="secondary career-nav-button career-logout-button"
              onClick={() => void logout()}
            >
              <Icon name="logout" size={18} /> Sair da conta
            </button>
          )}
        </div>
      }
      {!creating && !(joining && invitation) && (
        <div className="career-actions">
          <button
            disabled={actionsUnavailable || soloFull}
            onClick={() => {
              setReservation(null);
              setBoundLeague('');
              setRolled(false);
              setRoll([]);
              setTeamId('');
              setMode('offline');
              setCreating(true);
            }}
          >
            <Icon name="trophy" />
            <strong>Nova carreira solo</strong>
            <small>Comande seu clube e dispute cada título.</small>
            <span>{soloFull ? 'Limite de 2 carreiras solo atingido' : 'Criar carreira →'}</span>
          </button>
          <button
            disabled={actionsUnavailable || multiplayerFull}
            onClick={() => {
              setBoundLeague('');
              setRolled(false);
              setRoll([]);
              setTeamId('');
              setMode('multiplayer');
              setCreating(true);
            }}
          >
            <Icon name="ball" />
            <strong>Nova liga multiplayer</strong>
            <small>Seus amigos. Seus rivais. A mesma disputa.</small>
            <span>{multiplayerFull ? 'Sua vaga multiplayer está ocupada' : 'Criar liga →'}</span>
          </button>
          <button
            disabled={actionsUnavailable || multiplayerFull}
            onClick={() => {
              setJoining(true);
            }}
          >
            <Icon name="handshake" />
            <strong>Entrar com convite</strong>
            <small>Entre na liga dos seus amigos.</small>
            <span>{multiplayerFull ? 'Sua vaga multiplayer está ocupada' : 'Usar convite →'}</span>
          </button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {leagues.isLoading && (
        <div className="career-loading" role="status" aria-label="Carregando suas carreiras">
          <span className="career-loading-ball" aria-hidden="true">
            <Icon name="ball" size={36} />
          </span>
        </div>
      )}
      {leagues.error && (
        <p role="alert" className="form-error">
          {leagues.error.name === 'TimeoutError' || leagues.error.name === 'AbortError'
            ? 'O servidor demorou para iniciar. Tente carregar suas carreiras novamente.'
            : `Não foi possível carregar suas carreiras: ${leagues.error.message}`}
          <button
            className="secondary"
            disabled={leagues.isFetching}
            onClick={() => void leagues.refetch()}
          >
            {leagues.isFetching ? 'Consultando…' : 'Tentar novamente'}
          </button>
        </p>
      )}
      {!creating && !leagues.isLoading && !(joining && invitation) && (
        <section className="career-saves">
          {leagues.data?.map((league) => (
            <article className="career-save" key={league.id}>
              <button
                className="career-save-gear"
                aria-label={`Configurações de ${league.club?.name ?? league.name.replace(/\s*·\s*(Carreira|Amigos)\s*$/i, '')}`}
                aria-expanded={settingsId === league.id}
                onClick={() => setSettingsId(settingsId === league.id ? null : league.id)}
              >
                <Icon name="gear" />
              </button>
              {settingsId === league.id && (
                <div className="career-save-settings">
                  {league.administratorId === user.uid && (
                    <>
                      <button onClick={() => setConfirmation({ id: league.id, action: 'reset' })}>
                        Resetar carreira
                      </button>
                      <button
                        className="career-delete-option"
                        onClick={() => setConfirmation({ id: league.id, action: 'delete' })}
                      >
                        Excluir carreira
                      </button>
                    </>
                  )}
                  {league.mode === 'multiplayer' && (
                    <button onClick={() => setConfirmation({ id: league.id, action: 'leave' })}>
                      Abandonar liga
                    </button>
                  )}
                </div>
              )}
              <button
                className="career-save-open"
                disabled={busy}
                onClick={() => void connect(league.id)}
              >
                <span className="career-save-mode">
                  {league.mode === 'offline' ? 'Carreira solo' : 'Liga multiplayer'}
                </span>
                <PixelBadge
                  name={
                    league.club?.name ?? league.name.replace(/\s*·\s*(Carreira|Amigos)\s*$/i, '')
                  }
                  {...(league.club?.crestUrl ? { url: league.club.crestUrl } : {})}
                  size={80}
                />
                <strong>
                  {league.club?.name ?? league.name.replace(/\s*·\s*(Carreira|Amigos)\s*$/i, '')}
                </strong>
                <span className="career-save-stats">
                  <span>
                    <b>{league.season}</b>Temporada
                  </span>
                  <span>
                    <b>{league.round}</b>Rodada
                  </span>
                </span>
                <span className="career-save-continue">Entrar em campo →</span>
              </button>
            </article>
          ))}
          {Array.from({ length: Math.max(0, 3 - (leagues.data?.length ?? 0)) }, (_, index) => (
            <div
              className="career-add career-empty-slot"
              key={`empty-${index}`}
              aria-label="Espaço de carreira vazio"
            >
              <span aria-hidden="true">+</span>
              <strong>Espaço disponível</strong>
              <small>Crie sua carreira nas opções acima</small>
            </div>
          ))}
        </section>
      )}
      {creating && (
        <section className="creation-workspace">
          <div className="division-picker" role="group" aria-label="Divisão brasileira">
            {['A', 'B', 'C', 'D'].map((value) => (
              <button
                key={value}
                disabled={spinning || busy || Boolean(boundLeague || reservation)}
                aria-pressed={division === value}
                onClick={() => {
                  setDivision(value);
                  setTeamId('');
                  setRolled(false);
                  setRoll([]);
                }}
              >
                <DivisionBadge division={value} />
                <span>
                  Série {value}
                  <small>
                    {catalog.data?.clubs.filter((club) => club.division === value).length ?? 0}{' '}
                    clubes
                  </small>
                </span>
              </button>
            ))}
          </div>
          <div className="segmented choice-method">
            <button
              disabled={busy || spinning || Boolean(boundLeague || reservation)}
              className={choice === 'chosen' ? 'selected' : ''}
              onClick={() => setChoice('chosen')}
            >
              Escolher meu time
            </button>
            <button
              disabled={busy || spinning || Boolean(boundLeague || reservation)}
              className={choice === 'random' ? 'selected' : ''}
              onClick={() => setChoice('random')}
            >
              Sortear na roleta
            </button>
          </div>
          {choice === 'random' && !rolled && (
            <div className="roulette-panel">
              <div className="roulette-draw-label">
                <Icon name="ball" size={22} />
                <span>SORTEIO · SÉRIE {division}</span>
                <span>{teams.length} clubes</span>
              </div>
              <div className="roulette-window">
                <div className="roulette-pointer" />
                <div
                  ref={stripRef}
                  style={
                    {
                      '--roulette-cycle': `${-teams.length * 140}px`,
                      '--roulette-start': `${landingStart}px`,
                    } as CSSProperties
                  }
                  className={`roulette-strip ${spinning && !settling ? 'roulette-waiting' : settling || rolled ? 'rolling' : ''}`}
                >
                  {(roll.length ? roll : [...teams, ...teams, ...teams].map((team) => team.id)).map(
                    (id, i) => {
                      const team = teams.find((t) => t.id === id);
                      return (
                        <div className="roulette-card" key={i}>
                          <PixelBadge
                            name={team?.name ?? ''}
                            {...(team?.crestUrl ? { url: team.crestUrl } : {})}
                            size={64}
                          />
                          <strong>{team?.name}</strong>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
              <div className="roulette-draw-actions">
                <span>Deixe o destino escolher seu próximo escudo.</span>
                <button
                  className="primary"
                  disabled={
                    busy ||
                    spinning ||
                    !teams.length ||
                    Boolean(boundLeague) ||
                    Boolean(existingMode) ||
                    leagues.isPending ||
                    leagues.isError
                  }
                  onClick={() => void spin()}
                >
                  {spinning
                    ? settling
                      ? 'Revelando seu clube…'
                      : 'Reservando seu clube…'
                    : busy
                      ? 'Vinculando seu clube…'
                      : existingMode
                        ? 'Você já possui uma carreira neste modo'
                        : 'Girar roleta'}
                </button>
              </div>
              {rolled && <strong role="status">Seu clube: {selected?.name}</strong>}
            </div>
          )}
          <div
            className={`club-selection-body ${choice === 'random' ? 'selection-result' : 'selection-manual'}`}
          >
            {choice === 'chosen' && (
              <section className="club-picker" aria-label={`Clubes da Série ${division}`}>
                {catalog.isLoading && <p>Carregando escudos…</p>}
                {catalog.error && <p role="alert">{catalog.error.message}</p>}
                {!catalog.isLoading && !teams.length && (
                  <div className="panel empty-state">
                    <h2>Série {division}</h2>
                    <p>Esta divisão ainda não está na base importada.</p>
                  </div>
                )}
                {teams.map((club) => (
                  <button
                    className="club-choice"
                    key={club.id}
                    aria-pressed={selected?.id === club.id}
                    onClick={() => setTeamId(club.id)}
                  >
                    <PixelBadge
                      name={club.name}
                      {...(club.crestUrl ? { url: club.crestUrl } : {})}
                    />
                    <strong>{club.name}</strong>
                  </button>
                ))}
              </section>
            )}
            {(choice === 'chosen' || rolled) && (
              <aside className="panel club-confirmation">
                {selected ? (
                  <>
                    <PixelBadge
                      name={selected.name}
                      {...(selected.crestUrl ? { url: selected.crestUrl } : {})}
                      size={112}
                    />
                    <span className="eyebrow">BRASIL · SÉRIE {division}</span>
                    <h2>{selected.name}</h2>
                  </>
                ) : (
                  <h2>Escolha seu clube</h2>
                )}
                <button
                  className="primary full"
                  disabled={
                    busy ||
                    spinning ||
                    (choice === 'random' && !rolled) ||
                    !selected ||
                    leagues.isPending ||
                    leagues.isError
                  }
                  onClick={() => void start()}
                >
                  {busy ? 'Preparando sua carreira…' : 'Iniciar carreira'}
                  <Icon name="arrow" />
                </button>
              </aside>
            )}
          </div>
        </section>
      )}
      {confirmation && (
        <div className="modal-backdrop">
          <section
            className="panel invite-dialog career-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar alteração da carreira"
          >
            <Icon name="shield" />
            <h2>
              {confirmation.action === 'reset'
                ? 'Resetar esta carreira?'
                : confirmation.action === 'delete'
                  ? 'Excluir esta carreira?'
                  : 'Abandonar esta liga?'}
            </h2>
            <p>
              {confirmation.action === 'reset'
                ? 'Todo o progresso será apagado e os clubes começarão do zero. Isso afeta todos os participantes.'
                : confirmation.action === 'delete'
                  ? leagues.data?.find((league) => league.id === confirmation.id)?.mode ===
                    'multiplayer'
                    ? 'Você sairá da liga. Outro jogador assumirá a administração, se necessário. Se ninguém restar, a liga será excluída.'
                    : 'Esta carreira e todo o progresso serão excluídos. Você poderá escolher ou sortear outro clube.'
                  : 'Seu clube ficará reservado para seu retorno enquanto houver outros jogadores. Se o administrador sair, um sucessor será sorteado. Sem jogadores, a liga será excluída.'}
            </p>
            <div className="career-confirm-actions">
              <button
                className="career-confirm-danger"
                onClick={() => void manage(confirmation.id, confirmation.action)}
              >
                {confirmation.action === 'reset'
                  ? 'Sim, resetar carreira'
                  : confirmation.action === 'delete'
                    ? 'Sim, excluir carreira'
                    : 'Sim, abandonar liga'}
              </button>
              <button className="secondary" onClick={() => setConfirmation(null)}>
                Cancelar
              </button>
            </div>
          </section>
        </div>
      )}
      {joining && invitation && (
        <section className="creation-workspace invite-team-workspace">
          {invitation.assignment === 'chosen' ? (
            <div className="invite-team-grid">
              {invitation.clubs.map((club) => (
                <button
                  key={club.id}
                  className="club-choice"
                  disabled={club.occupied || busy}
                  aria-pressed={inviteClub === club.id}
                  onClick={() => setInviteClub(club.id)}
                >
                  <PixelBadge
                    name={club.name}
                    {...(club.crestUrl ? { url: club.crestUrl } : {})}
                    size={48}
                  />
                  <strong>{club.name}</strong>
                  <small>{club.occupied ? 'Ocupado' : `Série ${club.division}`}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="panel invite-random">
              <Icon name="ball" size={48} />
              <strong>Seu clube será sorteado entre os disponíveis</strong>
              <span>
                {invitation.clubs.filter((club) => !club.occupied).length} clubes livres · sorteio
                na aprovação da entrada
              </span>
            </div>
          )}
          <button
            className="primary"
            disabled={busy || !invitation || !invitation.clubs.some((club) => !club.occupied)}
            onClick={() => {
              const [id, invite] = code.trim().split(':');
              if (!id || !invite) {
                setError('Cole o convite completo recebido do administrador');
                return;
              }
              void request(`/api/leagues/${id}/request`, {
                method: 'POST',
                body: JSON.stringify({
                  code: invite,
                  ...(invitation?.assignment === 'chosen' && inviteClub
                    ? { clubId: inviteClub }
                    : {}),
                }),
              })
                .then((result) => {
                  setJoining(false);
                  if (z.object({ rejoined: z.boolean().optional() }).parse(result).rejoined) {
                    void connect(id);
                    void leagues.refetch();
                    return;
                  }
                  setError('Solicitação enviada. Aguarde aprovação e atualize suas carreiras.');
                })
                .catch((reason: unknown) =>
                  setError(reason instanceof Error ? reason.message : 'Convite inválido'),
                );
            }}
          >
            {invitation.assignment === 'random'
              ? 'Solicitar sorteio e entrada'
              : 'Solicitar entrada'}
          </button>
        </section>
      )}
      {joining && !invitation && (
        <div className="modal-backdrop">
          <section
            className="panel invite-dialog league-invite-ticket"
            role="dialog"
            aria-modal="true"
            aria-label="Entrar em uma liga"
          >
            <header className="invite-ticket-header">
              <span className="invite-ticket-seal">
                <Icon name="trophy" size={30} />
              </span>
              <div>
                <span className="invite-ticket-kicker">FOOTBALL HYPE · MULTIPLAYER</span>
                <h2>Seu lugar na liga</h2>
                <p>Convite de acesso do treinador</p>
              </div>
            </header>
            <div className="invite-ticket-body">
              {error && (
                <p className="invite-ticket-error" role="alert">
                  {error}
                </p>
              )}
              <label>
                Cole seu convite
                <input
                  aria-label="Código da liga"
                  value={code}
                  placeholder="Código recebido do administrador"
                  autoComplete="off"
                  onChange={(event) => {
                    setCode(event.target.value);
                    setInvitation(null);
                  }}
                />
              </label>
              <div className="invite-ticket-actions">
                {!invitation && (
                  <button
                    className="invite-ticket-primary"
                    disabled={!code.trim() || busy}
                    onClick={() => {
                      const [id, invite] = code.trim().split(':');
                      if (!id || !invite) {
                        setError('Cole o convite completo');
                        return;
                      }
                      void request(`/api/leagues/${id}/preview`, {
                        method: 'POST',
                        body: JSON.stringify({ code: invite }),
                      })
                        .then((data) => {
                          const parsed = z
                            .object({
                              admission: z.object({ assignment: z.enum(['chosen', 'random']) }),
                              clubs: z.array(
                                z.object({
                                  id: z.string(),
                                  name: z.string(),
                                  division: z.string(),
                                  occupied: z.boolean().optional(),
                                  crestUrl: z.string().optional(),
                                }),
                              ),
                            })
                            .parse(data);
                          setInvitation({
                            assignment: parsed.admission.assignment,
                            clubs: parsed.clubs,
                          });
                          setInviteClub(parsed.clubs.find((club) => !club.occupied)?.id ?? '');
                          setError('');
                        })
                        .catch((reason: unknown) =>
                          setError(reason instanceof Error ? reason.message : 'Convite inválido'),
                        );
                    }}
                  >
                    Validar convite <Icon name="arrow" size={18} />
                  </button>
                )}
                <button className="secondary" onClick={() => setJoining(false)}>
                  Cancelar
                </button>
              </div>
            </div>
            <footer className="invite-ticket-footer">
              <span className="invite-ticket-bars" aria-hidden="true" />
              <span>ACESSO EXCLUSIVO · ÁREA TÉCNICA</span>
              <Icon name="ball" size={20} />
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
