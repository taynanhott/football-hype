import { positionLabel } from '../../ui/position-label';
import { MoneyRange } from '../../ui/money-range';
import { useState } from 'react';
import { ceilMoney, clubKit, MONEY_STEPS, type PlayerSnapshot } from '@football/shared';
import {
  contractEnd,
  effectiveOverall,
  temporaryModifiers,
  renewalTerms,
  loanTerms,
} from '@football/domain';
import type { ViewProps } from '../../ui/view-props';
import { useGameStore } from '../../store/game-store';
import { currency } from '../../ui/format';
import { PlayerCard, Portrait } from './player-card';
import { ClubBadge, Icon } from '../../ui/icons';

export function PlayerManagement({
  player,
  snapshot,
  planningBusy = false,
  initialSection = 'policy',
  hideTabs = false,
}: Pick<ViewProps, 'snapshot'> & {
  player: PlayerSnapshot;
  planningBusy?: boolean;
  initialSection?: 'renew' | 'policy' | 'effects';
  hideTabs?: boolean;
}) {
  const state = snapshot.state,
    send = useGameStore((s) => s.send),
    serverBusy = useGameStore((s) => s.busy);
  const busy = serverBusy || planningBusy;
  const [section, setSection] = useState<'renew' | 'policy' | 'effects'>(initialSection);
  const policy = state.management?.policies?.[player.id] ?? {
    available: false,
    rivals: false,
    interest: 35,
  };
  const end = contractEnd(state, player),
    days = Math.ceil((end - state.lastProcessedAt) / 86400000);
  const [salaryDraft, setSalaryDraft] = useState({
    base: player.salary.cents,
    value: player.salary.cents,
  });
  const [years, setYears] = useState(1);
  const loan = loanTerms(state, player);
  const effects = temporaryModifiers(state, player);
  const terms = renewalTerms(state, player);
  const hasOffers =
    state.management?.offers?.some(
      (offer) =>
        offer.playerId === player.id &&
        offer.sellerId === player.clubId &&
        offer.status === 'pending',
    ) ?? false;
  const salaryMinimum = ceilMoney(player.salary.cents * 0.5, MONEY_STEPS.salary);
  const salaryMaximum = player.salary.cents * 2;
  const salaryCents =
    salaryDraft.base === player.salary.cents
      ? Math.max(salaryMinimum, Math.min(salaryMaximum, salaryDraft.value))
      : player.salary.cents;
  return (
    <section className="player-management transfer-policy-panel" data-section={section}>
      <p className={days <= 180 ? 'negative' : ''}>
        Contrato: {days <= 0 ? 'Encerrado' : days + ' dias restantes'} ·{' '}
        {new Date(end).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
        {days <= 180 ? ' · Renovação urgente' : ''}
      </p>
      {terms.demand && (
        <div className="contract-demand">
          <strong>Pedido de valorização</strong>
          <p>
            {player.name} pede salário de {currency(terms.minimumSalary)} após sua evolução.
          </p>
          <button type="button" onClick={() => setSection('renew')}>
            Negociar aumento
          </button>
          <button
            type="button"
            disabled={busy || Boolean(state.management?.contractHistory?.[player.id]?.dissatisfied)}
            onClick={() =>
              send({ type: 'management', action: 'reject-renewal', playerId: player.id })
            }
          >
            Recusar pedido (−8)
          </button>
        </div>
      )}
      {!hideTabs && (
        <div className="management-tabs" role="group" aria-label="Gestão do jogador">
          {(
            [
              { id: 'policy', label: 'Transferências' },
              { id: 'effects', label: 'Bônus e penalidades' },
              { id: 'renew', label: 'Renegociação' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={section === item.id ? 'selected' : ''}
              aria-pressed={section === item.id}
              disabled={busy}
              onClick={() => setSection(item.id)}
            >
              {item.label}
              {item.id === 'renew' && (terms.demand || days <= 180) && (
                <span className="squad-notification-dot" aria-label="Renovação pendente" />
              )}
              {item.id === 'policy' && hasOffers && (
                <span
                  className="transfer-alert-dot"
                  aria-label="Proposta recebida para este jogador"
                />
              )}
            </button>
          ))}
        </div>
      )}
      {section === 'effects' && (
        <div className="player-effect-list">
          {effects.length ? (
            effects.map((e) => (
              <p key={e.label} className={e.value > 0 ? 'positive' : 'negative'}>
                <b>
                  {e.value > 0 ? '+' : ''}
                  {e.value}
                </b>
                <span>
                  <strong>{e.label}</strong>
                  <small>{e.until}</small>
                </span>
              </p>
            ))
          ) : (
            <p>Sem modificadores temporários.</p>
          )}
        </div>
      )}
      {section === 'policy' && (
        <fieldset className="transfer-availability">
          <legend>Disponibilidade</legend>
          <label className="switch-row market-listing-toggle">
            <input
              type="checkbox"
              checked={!!(policy.available || policy.loanAvailable)}
              disabled={busy || Boolean(state.management?.loans?.[player.id])}
              onChange={(event) =>
                send({
                  type: 'management',
                  action: 'policy',
                  playerId: player.id,
                  available: event.target.checked,
                  loanAvailable: event.target.checked && !!policy.loanAvailable,
                  loanMonths: policy.loanMonths ?? 6,
                })
              }
            />
            No mercado
          </label>
          {(policy.available || policy.loanAvailable) && (
            <button
              type="button"
              className="loan-availability-toggle"
              aria-pressed={!!policy.loanAvailable}
              disabled={busy || !loan.eligible || Boolean(state.management?.loans?.[player.id])}
              onClick={() =>
                send({
                  type: 'management',
                  action: 'policy',
                  playerId: player.id,
                  available: true,
                  loanAvailable: !policy.loanAvailable,
                  loanMonths: policy.loanMonths ?? 6,
                })
              }
            >
              <Icon name="calendar" size={18} />
              <span>Disponível para empréstimo</span>
              <b>{policy.loanAvailable ? 'Sim' : 'Não'}</b>
            </button>
          )}
          {!loan.eligible && <small>Empréstimo exige mais de 6 meses restantes de contrato.</small>}
          {policy.loanAvailable && (
            <div className="loan-duration">
              <span>Prazo autorizado</span>
              <div className="segmented">
                {([6, 12] as const).map((months) => (
                  <button
                    key={months}
                    className={
                      (Math.min(policy.loanMonths ?? 12, loan.maxMonths) >= 12 ? 12 : 6) === months
                        ? 'selected'
                        : ''
                    }
                    disabled={busy || months > loan.maxMonths}
                    aria-pressed={
                      (Math.min(policy.loanMonths ?? 12, loan.maxMonths) >= 12 ? 12 : 6) === months
                    }
                    onClick={() =>
                      send({
                        type: 'management',
                        action: 'policy',
                        playerId: player.id,
                        ...policy,
                        loanMonths: months,
                      })
                    }
                  >
                    {months === 6 ? '6 meses' : '1 temporada'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </fieldset>
      )}
      {section === 'renew' && terms.reason && (
        <div className="renewal-refusal" role="status">
          <strong>{terms.reason}</strong>
        </div>
      )}
      {section === 'renew' && !terms.reason && (
        <div className="renewal-layout">
          <p>
            {terms.reason ||
              'Moral: ' +
                terms.morale +
                '% · Salário solicitado: ' +
                currency(terms.minimumSalary) +
                ' · Prazo total máximo: ' +
                terms.maxYears +
                ' anos'}
          </p>
          <label className="negotiation-range">
            <span>
              Salário mensal <output>{currency(salaryCents)}</output>
            </span>
            <MoneyRange
              min={salaryMinimum}
              max={salaryMaximum}
              step={MONEY_STEPS.salary}
              value={salaryCents}
              disabled={busy || salaryMaximum === 0}
              onChange={(e) =>
                setSalaryDraft({ base: player.salary.cents, value: Number(e.target.value) })
              }
            />
            <small>
              <span>50% · {currency(salaryMinimum)}</span>
              <span>200% · {currency(salaryMaximum)}</span>
            </small>
          </label>
          <fieldset className="renewal-years">
            <legend>Prazo do novo contrato</legend>
            <div className="segmented">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  aria-pressed={years === n}
                  className={years === n ? 'selected' : ''}
                  disabled={busy || n > terms.maxYears || n * 365 < days}
                  onClick={() => setYears(n)}
                >
                  {n} {n === 1 ? 'ano' : 'anos'}
                </button>
              ))}
            </div>
          </fieldset>
          <button
            className="negotiate-button full"
            disabled={
              busy ||
              Boolean(terms.reason) ||
              salaryCents <= 0 ||
              years > terms.maxYears ||
              years * 365 < days
            }
            onClick={() =>
              send({
                type: 'management',
                action: 'renew',
                playerId: player.id,
                salary: salaryCents,
                years,
              })
            }
          >
            Propor renovação · {currency(salaryCents)}
          </button>
        </div>
      )}
      {section === 'policy' && (
        <button
          type="button"
          className="player-policy-offers"
          disabled={!hasOffers}
          onClick={() => {
            location.hash = '/market?tab=proposals';
          }}
        >
          Propostas recebidas ↗
        </button>
      )}
    </section>
  );
}
export function IncomingOffers({ snapshot, club, playerId }: ViewProps & { playerId?: string }) {
  const presentation = 'list' as const;
  const send = useGameStore((s) => s.send),
    busy = useGameStore((s) => s.busy);
  const offers =
    snapshot.state.management?.offers?.filter(
      (o) =>
        o.sellerId === club.id && o.status === 'pending' && (!playerId || o.playerId === playerId),
    ) ?? [];
  const humanOffers = snapshot.state.negotiations.filter(
    (n) =>
      n.sellerId === club.id &&
      n.status === 'review' &&
      (n.expiresAt ?? Infinity) > snapshot.state.lastProcessedAt,
  );
  const renewals = club.playerIds.flatMap((id) => {
    const player = snapshot.state.players.byId[id];
    return player &&
      !snapshot.state.management?.loans?.[id] &&
      renewalTerms(snapshot.state, player).demand
      ? [player]
      : [];
  });
  return (
    <section className="incoming-offers" data-presentation={presentation}>
      {offers.length > 0 && (
        <div className="incoming-offers-heading">
          <div>
            <h2>Propostas recebidas</h2>
          </div>
          <span className="offer-status">{offers.length} pendentes</span>
        </div>
      )}
      {!offers.length && !renewals.length && !humanOffers.length && (
        <div className="offers-empty-state">
          <span className="offers-empty-icon">
            <Icon name="handshake" size={30} />
          </span>
          <div>
            <strong>Nenhuma proposta no momento</strong>
            <p>Disponibilize jogadores para negociação e acompanhe as ofertas aqui.</p>
          </div>
          <a href="#/squad">
            Gerenciar elenco <span aria-hidden="true">→</span>
          </a>
        </div>
      )}
      <div className="incoming-offers-grid">
        {humanOffers.map((n) => (
          <article className="incoming-offer human-transfer-offer" key={n.id}>
            <h3>
              {snapshot.state.players.byId[n.playerId]?.name} · {currency(n.fee)}
            </h3>
            <p>
              {snapshot.state.clubs.byId[n.buyerId]?.name} aguarda sua decisão. Validade: 2 semanas.
            </p>
            <div className="offer-actions">
              <button
                disabled={busy}
                onClick={() =>
                  send({ type: 'management', action: 'accept-transfer', offerId: n.id })
                }
              >
                Aceitar e liberar conversa com o atleta
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  send({ type: 'management', action: 'reject-transfer', offerId: n.id })
                }
              >
                Recusar
              </button>
            </div>
          </article>
        ))}

        {renewals.map((player) => (
          <article key={'renew:' + player.id} className="incoming-offer renewal-offer">
            <h3>Renovação solicitada · {player.name}</h3>
            <PlayerManagement player={player} snapshot={snapshot} initialSection="renew" hideTabs />
          </article>
        ))}

        {offers.map((o) => {
          const player = snapshot.state.players.byId[o.playerId];
          const buyer = snapshot.state.clubs.byId[o.buyerId];
          const difference = player ? o.fee - player.marketValue.cents : 0;
          return (
            <article
              className={`incoming-offer ${o.kind === 'loan' ? 'loan-offer' : ''}`}
              key={o.id}
            >
              <header className="offer-buyer">
                <ClubBadge
                  name={buyer?.name ?? 'Clube interessado'}
                  kit={clubKit(buyer)}
                  size={40}
                />
                <div>
                  <span>CLUBE INTERESSADO</span>
                  <a href={'#/trophies?club=' + o.buyerId}>
                    {buyer?.name ?? 'Clube interessado'} ↗
                  </a>
                </div>
                {player && (
                  <span
                    className="offer-status market-overall-badge"
                    data-tier={
                      player.overall <= 69
                        ? 'bronze'
                        : player.overall <= 77
                          ? 'silver'
                          : player.overall <= 85
                            ? 'gold'
                            : 'diamond'
                    }
                    aria-label={`Overall ${player.overall}`}
                  >
                    {player.overall}
                  </span>
                )}
              </header>
              <div className="offer-body">
                {player &&
                  (presentation === 'list' ? (
                    <div className="offer-list-portrait">
                      <Portrait player={player} clubName={club.name} kit={clubKit(club)} />
                    </div>
                  ) : (
                    <PlayerCard
                      player={player}
                      clubName={club.name}
                      kit={clubKit(club)}
                      modifier={effectiveOverall(snapshot.state, player) - player.overall}
                    />
                  ))}
                <div className="incoming-offer-details">
                  <span className="eyebrow">
                    {o.kind === 'loan' ? 'PROPOSTA DE EMPRÉSTIMO' : 'PROPOSTA DE COMPRA'}
                  </span>
                  {o.kind === 'loan' && (
                    <p>
                      {o.months} meses · {o.salaryPercent}% do salário ({currency(o.salary)}/mês)
                    </p>
                  )}
                  <h3>{player?.name ?? 'Jogador indisponível'}</h3>
                  {player && (
                    <p>
                      {positionLabel(player.position)} · {player.age} anos · {club.name}
                    </p>
                  )}
                  <div className="offer-amount">
                    <span>
                      {o.kind === 'loan' ? 'Salário pago pelo tomador' : 'Valor oferecido'}
                    </span>
                    <strong>{currency(o.kind === 'loan' ? o.salary : o.fee)}</strong>
                    {player && (
                      <small>
                        Valor de mercado: {currency(player.marketValue.cents)}
                        <br />
                        Salário atual no clube: {currency(player.salary.cents)}/mês
                      </small>
                    )}
                  </div>
                  {player && o.kind !== 'loan' && (
                    <p className={`offer-comparison ${difference >= 0 ? 'positive' : 'negative'}`}>
                      {difference === 0
                        ? 'No valor de mercado'
                        : `${currency(Math.abs(difference))} ${difference > 0 ? 'acima' : 'abaixo'} do valor de mercado`}
                    </p>
                  )}
                </div>
              </div>
              <footer className="offer-actions">
                <span>A decisão é sua</span>
                <button
                  disabled={busy}
                  className="negotiate-button"
                  onClick={() => send({ type: 'management', action: 'accept', offerId: o.id })}
                >
                  {o.kind === 'loan' ? 'Aceitar empréstimo' : 'Aceitar venda'}
                </button>
                <button
                  disabled={busy}
                  className="secondary"
                  onClick={() => send({ type: 'management', action: 'reject', offerId: o.id })}
                >
                  Recusar
                </button>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
