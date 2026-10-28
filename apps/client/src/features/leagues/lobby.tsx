import { BrandMark } from '../../ui/brand-mark';
import { Select, Option } from '../../ui/select';
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
            <div className="pitch-lines">
              <i />
              <b />
            </div>
            <div className="stadium-ticket">
              <BrandMark size={64} />
              <span>ACESSO DO TÉCNICO</span>
              <strong>2026</strong>
              <small>VESTIÁRIO · ÁREA TÉCNICA</small>
            </div>
          </div>
          <div className="login-access">
            <span className="eyebrow">ÁREA DO TÉCNICO</span>
            <h2>Acesse seu vestiário</h2>
            <p>Entre para continuar suas carreiras e criar novas ligas.</p>
            <button
              className="primary"
              disabled={busy || session.loading || !firebaseEnabled}
              onClick={() => void login()}
            >
              {session.loading ? 'Conectando…' : busy ? 'Abrindo Google…' : 'Entrar com Google'}
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
  const [choice, setChoice] = useState<'chosen' | 'random'>('chosen');
  const [settling, setSettling] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [roll, setRoll] = useState<string[]>([]);
  const [rolled, setRolled] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    id: string;
    action: 'leave' | 'delete';
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
    clubs: { id: string; name: string; division: string }[];
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
  const existingMode = leagues.data?.find((league) => league.mode === mode);
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
  async function manage(id: string, action: 'leave' | 'delete') {
    try {
      setConfirmation(null);
      await request(`/api/leagues/${id}/${action}`, { method: 'POST' });
      queryClient.setQueryData<Awaited<ReturnType<typeof listLeagues>>>(
        ['leagues', user.uid],
        (previous) => previous?.filter((league) => league.id !== id),
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
    <main
      className={`club-selection ${creating && choice === 'chosen' ? 'manual-team-screen' : ''}`}
    >
      {!creating && (
        <div className="career-toolbar">
          <span>
            <Icon name="shield" /> {user.name}
          </span>
          <button className="secondary" onClick={() => void logout()}>
            Sair da conta
          </button>
        </div>
      )}
      {!creating && (
        <div className="career-actions">
          <button
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
            <span>Criar carreira →</span>
          </button>
          <button
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
            <span>Criar liga →</span>
          </button>
          <button onClick={() => setJoining(true)}>
            <Icon name="handshake" />
            <strong>Entrar com convite</strong>
            <small>Entre na liga dos seus amigos.</small>
            <span>Usar convite →</span>
          </button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {leagues.isLoading && <p>Carregando suas carreiras…</p>}
      {leagues.error && (
        <p role="alert" className="form-error">
          Não foi possível carregar suas carreiras. O servidor não respondeu a tempo.
          <button
            className="secondary"
            disabled={leagues.isFetching}
            onClick={() => void leagues.refetch()}
          >
            {leagues.isFetching ? 'Consultando…' : 'Tentar novamente'}
          </button>
        </p>
      )}
      {!creating && Boolean(leagues.data?.length) && (
        <section className="saved-leagues panel">
          <h2>Suas carreiras</h2>
          {leagues.data?.map((league) => (
            <div key={league.id}>
              <button disabled={busy} onClick={() => void connect(league.id)}>
                <span>
                  {league.name}
                  <small>
                    {league.mode === 'offline' ? 'Solo' : 'Multiplayer'} · {league.season} · rodada{' '}
                    {league.round}
                  </small>
                </span>
                <span>
                  Continuar <Icon name="arrow" />
                </span>
              </button>
              {league.mode === 'multiplayer' && (
                <button
                  disabled={busy}
                  onClick={() => setConfirmation({ id: league.id, action: 'leave' })}
                >
                  Abandonar liga
                </button>
              )}
              {league.administratorId === user.uid && (
                <button
                  disabled={busy}
                  onClick={() => setConfirmation({ id: league.id, action: 'delete' })}
                >
                  Excluir liga
                </button>
              )}
            </div>
          ))}
        </section>
      )}
      {!creating && leagues.isSuccess && !leagues.data?.length && (
        <div className="career-empty">
          <Icon name="trophy" />
          <p>Suas carreiras aparecerão aqui.</p>
          <small>Escolha um modo acima para entrar em campo.</small>
        </div>
      )}
      {creating && (
        <section className="creation-workspace">
          <div className="career-toolbar">
            <button
              className="secondary"
              disabled={busy || spinning}
              onClick={() => setCreating(false)}
            >
              ← Suas carreiras
            </button>
            <strong>{mode === 'offline' ? 'Nova carreira solo' : 'Nova liga multiplayer'}</strong>
          </div>
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
                  {roll.map((id, i) => {
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
                  })}
                </div>
                {!roll.length && (
                  <span className="roulette-placeholder">O próximo escudo pode ser o seu.</span>
                )}
              </div>
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
          <footer className="lobby-footer">{catalog.data?.source}</footer>
        </section>
      )}
      {confirmation && (
        <div className="modal-backdrop">
          <section
            className="panel invite-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar alteração da carreira"
          >
            <Icon name="shield" />
            <h2>
              {confirmation.action === 'delete' ? 'Excluir esta liga?' : 'Abandonar esta liga?'}
            </h2>
            <p>
              {confirmation.action === 'delete'
                ? 'A carreira será excluída para todos os participantes.'
                : 'Um bot assumirá seu clube e a vaga será liberada.'}
            </p>
            <button
              className="primary"
              onClick={() => void manage(confirmation.id, confirmation.action)}
            >
              Confirmar
            </button>
            <button className="secondary" onClick={() => setConfirmation(null)}>
              Cancelar
            </button>
          </section>
        </div>
      )}
      {joining && (
        <div className="modal-backdrop">
          <section
            className="panel invite-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Entrar em uma liga"
          >
            <h2>Jogue com seus amigos</h2>
            <p>
              Consulte o convite para escolher entre os times da divisão permitida pelo
              administrador.
            </p>
            {error && <p role="alert">{error}</p>}
            <label>
              Código da liga
              <input
                aria-label="Código da liga"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setInvitation(null);
                }}
              />
            </label>
            {!invitation && (
              <button
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
                            z.object({ id: z.string(), name: z.string(), division: z.string() }),
                          ),
                        })
                        .parse(data);
                      setInvitation({
                        assignment: parsed.admission.assignment,
                        clubs: parsed.clubs,
                      });
                      setInviteClub(parsed.clubs[0]?.id ?? '');
                      setError('');
                    })
                    .catch((reason: unknown) =>
                      setError(reason instanceof Error ? reason.message : 'Convite inválido'),
                    );
                }}
              >
                Ver times disponíveis
              </button>
            )}
            {invitation &&
              (invitation.assignment === 'random' ? (
                <p>
                  O administrador sorteará um dos {invitation.clubs.length} clubes disponíveis ao
                  aprovar sua entrada.
                </p>
              ) : (
                <label>
                  Seu clube na divisão permitida
                  <Select value={inviteClub} onValueChange={(value) => setInviteClub(value)}>
                    {invitation.clubs.map((c) => (
                      <Option key={c.id} value={c.id}>
                        {c.name} · Série {c.division}
                      </Option>
                    ))}
                  </Select>
                </label>
              ))}
            <button
              className="primary"
              disabled={busy || !invitation || !invitation.clubs.length}
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
                  .then(() => {
                    setJoining(false);
                    setError('Solicitação enviada. Aguarde aprovação e atualize suas carreiras.');
                  })
                  .catch((reason: unknown) =>
                    setError(reason instanceof Error ? reason.message : 'Convite inválido'),
                  );
              }}
            >
              Solicitar entrada
            </button>
            <button className="secondary" onClick={() => setJoining(false)}>
              Cancelar
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
