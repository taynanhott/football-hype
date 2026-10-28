import { BrandMark } from '../../ui/brand-mark';
import { Select, Option } from '../../ui/select';
import { useState } from 'react';
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
          <span className="eyebrow">SEU CLUBE. SUA HISTÓRIA.</span>
          <h1>
            O próximo grande
            <br />
            técnico é você.
          </h1>
          <p>Entre com o Google para escolher seu clube e continuar suas carreiras.</p>
          <div className="login-pixel-ball">
            <DivisionBadge division="★" />
          </div>
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
      ) : (
        <AuthenticatedLobby user={session.user} />
      )}
    </div>
  );
}
function AuthenticatedLobby({ user }: { user: { uid: string; name: string } }) {
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
    queryFn: loadCatalog,
    staleTime: 60000,
    retry: false,
  });
  const leagues = useQuery({
    queryKey: ['leagues', user.uid],
    queryFn: listLeagues,
    retry: false,
    refetchInterval: 10000,
  });
  const teams = (catalog.data?.clubs ?? []).filter((club) => club.division === division);
  const selected = teams.find((club) => club.id === teamId) ?? teams[0];
  const existingMode = leagues.data?.find((league) => league.mode === mode);
  async function start() {
    if (!selected) return;
    setError('');
    try {
      useGameStore.setState({ busy: true });
      const id = await createLeague(
        `${selected.name} · ${mode === 'offline' ? 'Carreira' : 'Amigos'}`,
        mode,
        selected.id,
        'chosen',
      );
      await connect(id);
      await queryClient.invalidateQueries({ queryKey: ['leagues', user.uid] });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar a liga');
      useGameStore.setState({ busy: false });
    }
  }
  async function manage(id: string, action: 'leave' | 'delete') {
    if (
      !window.confirm(
        action === 'delete'
          ? 'Excluir esta liga para todos os participantes?'
          : 'Abandonar a liga? Um bot assumirá seu clube e a vaga será liberada.',
      )
    )
      return;
    try {
      await request(`/api/leagues/${id}/${action}`, { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: ['leagues'] });
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
    <main className="club-selection">
      <div className="club-selection-heading">
        <div>
          <span className="eyebrow">BEM-VINDO, {user.name.toUpperCase()}</span>
          <h1>Escolha as suas cores.</h1>
          <p>Um escudo. Uma torcida. Uma nova história para escrever.</p>
        </div>
        <button className="secondary" onClick={() => void logout()}>
          Sair da conta
        </button>
      </div>
      {leagues.isLoading && <p>Carregando suas carreiras…</p>}
      {leagues.error && (
        <p role="alert" className="form-error">
          {leagues.error.message}
        </p>
      )}
      {Boolean(leagues.data?.length) && (
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
                <button disabled={busy} onClick={() => void manage(league.id, 'leave')}>
                  Abandonar liga
                </button>
              )}
              {league.administratorId === user.uid && (
                <button disabled={busy} onClick={() => void manage(league.id, 'delete')}>
                  Excluir liga
                </button>
              )}
            </div>
          ))}
        </section>
      )}
      <div className="division-picker" role="group" aria-label="Divisão brasileira">
        {['A', 'B', 'C', 'D'].map((value) => (
          <button
            key={value}
            aria-pressed={division === value}
            onClick={() => {
              setDivision(value);
              setTeamId('');
            }}
          >
            <DivisionBadge division={value} />
            <span>
              Série {value}
              <small>
                {catalog.data?.clubs.filter((club) => club.division === value).length ?? 0} clubes
              </small>
            </span>
          </button>
        ))}
      </div>
      <div className="club-selection-body">
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
              <PixelBadge name={club.name} {...(club.crestUrl ? { url: club.crestUrl } : {})} />
              <strong>{club.name}</strong>
            </button>
          ))}
        </section>
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
          <div className="segmented">
            <button
              className={mode === 'offline' ? 'selected' : ''}
              onClick={() => setMode('offline')}
            >
              Carreira solo
            </button>
            <button
              className={mode === 'multiplayer' ? 'selected' : ''}
              onClick={() => setMode('multiplayer')}
            >
              Liga com amigos
            </button>
          </div>
          <button
            className="primary full"
            disabled={busy || !selected || Boolean(existingMode)}
            onClick={() => void start()}
          >
            {existingMode
              ? 'Continue sua carreira acima'
              : busy
                ? 'Preparando sua carreira…'
                : 'Começar minha história'}
            <Icon name="arrow" />
          </button>
          <button className="secondary full" onClick={() => setJoining(true)}>
            Tenho um convite
          </button>
          <p className="form-note">
            Uma carreira solo e uma liga com amigos por conta. As carreiras vinculadas aparecem
            acima.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </aside>
      </div>
      <footer className="lobby-footer">{catalog.data?.source}</footer>
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
