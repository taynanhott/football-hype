import { request } from '../features/leagues/api';
import { CoachAvatar, CoachEditor } from './coach-profile';
import { readCoach } from './coach-profile-storage';
import { useSession } from '../features/auth/session';
import { AdvanceRoundButton } from '../features/leagues/advance-round-button';
import { BrandMark } from './brand-mark';
import { MATCH_DURATION_MS } from '@football/shared';
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGameStore } from '../store/game-store';
import { Lobby } from '../features/leagues/lobby';
import { Dashboard } from '../features/dashboard/dashboard';
import { LineupEditor } from '../features/players/lineup';
import { Squad } from '../features/players/squad';
import { Market } from '../features/market/market';
import { Facilities } from '../features/facilities/facilities';
import { Finance } from '../features/finance/finance';
import { Matches } from '../features/matches/matches';
import { LeagueSettings, TrophyGallery } from '../features/leagues/settings';
import { Calendar } from '../features/competitions/calendar';
import { Icon } from './icons';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
});
const ROUTES = [
  { id: 'dashboard', label: 'Visão geral' },
  { id: 'squad', label: 'Elenco' },
  { id: 'lineup', label: 'Escalação' },
  { id: 'market', label: 'Transferências' },
  { id: 'calendar', label: 'Torneios' },
  { id: 'stadium', label: 'Estádio' },
  { id: 'training', label: 'Centro de treinamento' },
  { id: 'finance', label: 'Finanças' },
  { id: 'matches', label: 'Central de partidas' },
  { id: 'trophies', label: 'Carreira' },
  { id: 'settings', label: 'Gerenciamento' },
];
function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}
function currentRoute() {
  return location.hash.slice(2).split('?')[0] || 'dashboard';
}

function scrollPageToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  document.querySelectorAll('.workspace, .main-content').forEach((element) => {
    element.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  });
}

function GameApp() {
  const route = useSyncExternalStore(subscribe, currentRoute);
  const { user } = useSession();
  const profileKey = `football.coach.${user?.uid ?? useGameStore.getState().userId}`;
  const [coach, setCoach] = useState(() => readCoach(profileKey));
  const [loadedProfileKey, setLoadedProfileKey] = useState(profileKey);
  if (loadedProfileKey !== profileKey) {
    setLoadedProfileKey(profileKey);
    setCoach(readCoach(profileKey));
  }

  useLayoutEffect(() => {
    scrollPageToTop();
  }, [route]);

  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const navigate = () => setMenuOpen(false);
    window.addEventListener('keydown', close);
    window.addEventListener('hashchange', navigate);
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('hashchange', navigate);
    };
  }, []);
  const {
    snapshot,
    connected,
    busy,
    pendingActions,
    error,
    userId,
    send,
    disconnect,
    clearError,
    connect,
  } = useGameStore();
  const leagueId = snapshot?.state.id;
  const remoteCoach = snapshot?.state.participants.find((p) => p.userId === userId)?.coach;
  const coachProfile = remoteCoach ?? { ...coach, name: coach.name || user?.name || 'Técnico' };
  useEffect(() => {
    if (!leagueId || !connected) return;
    const local = readCoach(profileKey);
    if (remoteCoach) {
      localStorage.setItem(profileKey, JSON.stringify(remoteCoach));
    } else {
      void request(`/api/leagues/${leagueId}/profile`, {
        method: 'POST',
        body: JSON.stringify({ ...local, name: local.name || user?.name || 'Técnico' }),
      }).catch((reason: unknown) =>
        useGameStore.setState({
          error: reason instanceof Error ? reason.message : 'Falha ao salvar técnico',
        }),
      );
    }
  }, [leagueId, connected, profileKey, remoteCoach, user?.name]);
  const latestMatch = snapshot?.state.results
    .filter(
      (r) =>
        r.homeId === snapshot.state.participants.find((p) => p.userId === userId)?.clubId ||
        r.awayId === snapshot.state.participants.find((p) => p.userId === userId)?.clubId,
    )
    .at(-1);
  useEffect(() => {
    if (
      latestMatch?.startedAt &&
      Date.now() + useGameStore.getState().clockOffset - latestMatch.startedAt < MATCH_DURATION_MS
    )
      location.hash = '/matches';
  }, [latestMatch?.startedAt]);
  if (!snapshot)
    return (
      <>
        <Lobby />
        {error && (
          <div className="toast error" role="alert">
            <span>{error}</span>
            <button aria-label="Fechar aviso" onClick={clearError}>
              ×
            </button>
          </div>
        )}
      </>
    );
  const { state } = snapshot;
  const participant = state.participants.find((member) => member.userId === userId);
  const club = state.clubs.byId[participant?.clubId ?? ''];
  const stadium = state.stadiums.byId[club?.stadiumId ?? ''];
  const center = state.centers.byId[club?.trainingCenterId ?? ''];
  if (!club || !stadium || !center)
    return (
      <div className="empty-state">
        <h1>Não foi possível carregar seu clube.</h1>
        <button onClick={disconnect}>Voltar às carreiras</button>
      </div>
    );
  const props = { snapshot, club, stadium, center };
  const ready = state.participants.filter((member) => member.ready).length;
  const view =
    route === 'coach' ? (
      <CoachEditor
        key={profileKey}
        profile={coachProfile}
        onSave={async (profile) => {
          await request(`/api/leagues/${state.id}/profile`, {
            method: 'POST',
            body: JSON.stringify(profile),
          });
          localStorage.setItem(profileKey, JSON.stringify(profile));
          setCoach(profile);
        }}
      />
    ) : route === 'matches' ? (
      <Matches {...props} />
    ) : route === 'settings' && state.mode === 'multiplayer' ? (
      <LeagueSettings {...props} />
    ) : route === 'trophies' ? (
      <TrophyGallery {...props} />
    ) : route === 'lineup' ? (
      <LineupEditor {...props} />
    ) : route === 'squad' ? (
      <Squad {...props} />
    ) : route === 'market' ? (
      <Market {...props} />
    ) : route === 'calendar' ? (
      <Calendar {...props} />
    ) : route === 'stadium' ? (
      <Facilities {...props} />
    ) : route === 'training' ? (
      <Facilities {...props} training />
    ) : route === 'finance' ? (
      <Finance {...props} />
    ) : (
      <Dashboard {...props} />
    );
  return (
    <div className={route === 'matches' ? 'app-shell match-view' : 'app-shell'}>
      {menuOpen && (
        <button
          className="mobile-menu-shade"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        id="main-navigation"
        onClick={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest('a[href^="#/"]') &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey &&
            !event.altKey
          ) {
            setMenuOpen(false);
            scrollPageToTop();
          }
        }}
        className={'sidebar ' + (menuOpen ? 'mobile-open' : '')}
      >
        <a className="brand" href="#/dashboard">
          <BrandMark size={46} />
          <span>
            FOOTBALL HYPE<small>FOOTBALL MANAGER</small>
          </span>
        </a>
        <span className="nav-caption">ÁREA TÉCNICA</span>
        <nav aria-label="Navegação principal">
          {ROUTES.filter((item) => item.id !== 'settings' || state.mode === 'multiplayer').map(
            (item) => (
              <a
                key={item.id}
                href={`#/${item.id}`}
                className={route === item.id ? 'active' : ''}
                aria-current={route === item.id ? 'page' : undefined}
              >
                <Icon name={item.id} />
                <span>{item.label}</span>
                {item.id === 'market' && <span className="nav-dot" />}
              </a>
            ),
          )}
        </nav>
        <button className="sidebar-exit" onClick={disconnect}>
          ← Trocar de carreira
        </button>
        <a className="sidebar-user" href="#/coach" aria-label="Editar treinador">
          <span className="avatar">
            <CoachAvatar profile={coachProfile} />
          </span>
          <div>
            <strong>{coachProfile.name}</strong>
            <div className="save-queue-status" role="status">
              {!connected
                ? 'Reconecte para sincronizar a carreira'
                : pendingActions
                  ? `${pendingActions} ${pendingActions === 1 ? 'ação sincronizando' : 'ações sincronizando'}…`
                  : error
                    ? 'Confira a sincronização da carreira'
                    : '✓ Carreira sincronizada'}
            </div>
            <small>
              {state.mode === 'offline'
                ? 'Carreira solo'
                : `${state.participants.length} treinadores na liga`}
            </small>
          </div>
          <span className={connected ? 'status-dot' : 'status-dot offline'} />
        </a>
      </aside>
      <div className="workspace">
        {!connected && (
          <div className="connection-banner">
            Você está desconectado.{' '}
            <button onClick={() => void connect(state.id)}>Reconectar à liga</button>
          </div>
        )}
        <main className="main-content" key={route}>
          {view}
        </main>
        {route === 'dashboard' && (
          <div className="matchday-bar">
            <div>
              <span className="matchday-icon">
                <Icon name="kickoff" size={24} />
              </span>
              <div>
                <strong>
                  {!connected
                    ? 'Reconecte para conferir a rodada'
                    : state.status === 'finished'
                      ? 'Temporada encerrada'
                      : busy
                        ? 'O clube está em movimento…'
                        : 'Preparado para o próximo desafio?'}
                </strong>
                <span>
                  {state.status === 'finished'
                    ? 'Comece uma nova temporada com acessos e descensos.'
                    : state.mode === 'offline'
                      ? 'Avance a rodada quando seu time estiver preparado.'
                      : `${ready} de ${state.participants.length} treinadores prontos · A maioria antecipa a rodada`}
                </span>
              </div>
            </div>
            <div className="matchday-actions">
              {state.status === 'active' ? (
                <>
                  {state.mode === 'multiplayer' && (
                    <button
                      aria-pressed={participant?.ready ?? false}
                      className={`ready-button ${participant?.ready ? 'checked' : ''}`}
                      disabled={busy || !connected}
                      onClick={() => send({ type: 'ready', ready: !participant?.ready })}
                    >
                      {participant?.ready ? '✓ Pronto · desfazer' : 'Marcar pronto'}
                    </button>
                  )}
                  {userId === state.administratorId && (
                    <AdvanceRoundButton disabled={busy || !connected} />
                  )}
                </>
              ) : (
                userId === state.administratorId && (
                  <button
                    className="primary"
                    disabled={busy || !connected}
                    onClick={() => send({ type: 'new-season' })}
                  >
                    Iniciar próxima temporada <Icon name="arrow" />
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>
      <nav className="mobile-bottom-nav" aria-label="Atalhos de navegação">
        <button
          aria-label="Menu"
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name="menu" />
        </button>
        <a
          href="#/dashboard"
          aria-label="Home"
          aria-current={route === 'dashboard' ? 'page' : undefined}
        >
          <Icon name="home" />
        </a>
        <a
          href="#/calendar"
          aria-label="Calendário"
          aria-current={route === 'calendar' ? 'page' : undefined}
        >
          <Icon name="calendar" />
        </a>
      </nav>
      {error && (
        <div className="toast error" role="alert">
          <span>{error}</span>
          <button aria-label="Fechar aviso" onClick={clearError}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GameApp />
    </QueryClientProvider>
  );
}
