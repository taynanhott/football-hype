import { positionLabel } from '../../ui/position-label';
import { MoneyRange } from '../../ui/money-range';
import { useState } from 'react';
import { ceilMoney, clubKit, MONEY_STEPS, type PlayerSnapshot } from '@football/shared';
import {
  contractEnd,
  effectiveOverall,
  financialLimits,
  temporaryModifiers,
  renewalTerms,
} from '@football/domain';
import type { ViewProps } from '../../ui/view-props';
import { useGameStore } from '../../store/game-store';
import { currency } from '../../ui/format';
import { PlayerCard } from './player-card';
import { ClubBadge, Icon } from '../../ui/icons';

export function PlayerManagement({
  player,
  snapshot,
}: Pick<ViewProps, 'snapshot'> & { player: PlayerSnapshot }) {
  const state = snapshot.state,
    send = useGameStore((s) => s.send),
    busy = useGameStore((s) => s.busy);
  const [section, setSection] = useState<'renew' | 'policy' | 'effects'>('effects');
  const policy = state.management?.policies?.[player.id] ?? {
    available: false,
    rivals: false,
    interest: 35,
  };
  const end = contractEnd(state, player),
    days = Math.ceil((end - state.lastProcessedAt) / 86400000);
  const [salary, setSalary] = useState(
    String(
      ceilMoney(Math.max(player.salary.cents, player.marketValue.cents / 240), MONEY_STEPS.salary) /
        100,
    ),
  );
  const [years, setYears] = useState(1);
  const effects = temporaryModifiers(state, player);
  const terms = renewalTerms(state, player);
  const club = state.clubs.byId[player.clubId ?? ''];
  const salaryMaximum = club ? financialLimits(state, club).salary + player.salary.cents : 0;
  const salaryCents = Math.min(salaryMaximum, ceilMoney(Number(salary) * 100, MONEY_STEPS.salary));
  return (
    <section className="player-management transfer-policy-panel">
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
      <div className="management-tabs" role="group" aria-label="Gestão do jogador">
        {(
          [
            { id: 'effects', label: 'Bônus e penalidades' },
            { id: 'policy', label: 'Negociação' },
            { id: 'renew', label: 'Renegociação' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            className={section === item.id ? 'selected' : ''}
            aria-pressed={section === item.id}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {section === 'effects' && (
        <div>
          {effects.length ? (
            effects.map((e) => (
              <p key={e.label} className={e.value > 0 ? 'positive' : 'negative'}>
                {e.value > 0 ? '+' : ''}
                {e.value} {e.label} · {e.until}
              </p>
            ))
          ) : (
            <p>Sem modificadores temporários.</p>
          )}
        </div>
      )}
      {section === 'policy' && (
        <>
          <label className="switch-row">
            <input
              type="checkbox"
              role="switch"
              checked={policy.available}
              disabled={busy}
              onChange={(e) =>
                send({
                  type: 'management',
                  action: 'policy',
                  playerId: player.id,
                  ...policy,
                  available: e.target.checked,
                })
              }
            />
            Disponível para negociação
          </label>
          <label className="switch-row">
            <input
              type="checkbox"
              role="switch"
              checked={policy.rivals}
              disabled={busy || !policy.available}
              onChange={(e) =>
                send({
                  type: 'management',
                  action: 'policy',
                  playerId: player.id,
                  ...policy,
                  rivals: e.target.checked,
                })
              }
            />
            Aceitar rivais
          </label>
          <label>
            Interesse em vender: {policy.interest}/100
            <input
              type="range"
              min="1"
              max="100"
              defaultValue={policy.interest}
              key={policy.interest}
              disabled={busy || !policy.available}
              onPointerUp={(e) =>
                send({
                  type: 'management',
                  action: 'policy',
                  playerId: player.id,
                  ...policy,
                  interest: Number(e.currentTarget.value),
                })
              }
              onKeyUp={(e) => {
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key))
                  send({
                    type: 'management',
                    action: 'policy',
                    playerId: player.id,
                    ...policy,
                    interest: Number(e.currentTarget.value),
                  });
              }}
            />
          </label>
        </>
      )}
      {section === 'renew' && terms.reason && (
        <div className="renewal-refusal" role="status">
          <strong>{terms.reason}</strong>
        </div>
      )}
      {section === 'renew' && !terms.reason && (
        <div>
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
              min={0}
              max={salaryMaximum}
              step={MONEY_STEPS.salary}
              value={salaryCents}
              disabled={busy || salaryMaximum === 0}
              onChange={(e) => setSalary(String(Number(e.target.value) / 100))}
            />
            <small>
              <span>{currency(0)}</span>
              <span>Disponível: {currency(salaryMaximum)}</span>
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
                  disabled={busy || (player.age >= 32 && n > terms.maxYears)}
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
              (player.age >= 32 && years > terms.maxYears)
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
    </section>
  );
}
export function IncomingOffers({ snapshot, club, playerId }: ViewProps & { playerId?: string }) {
  const send = useGameStore((s) => s.send),
    busy = useGameStore((s) => s.busy);
  const offers =
    snapshot.state.management?.offers?.filter(
      (o) =>
        o.sellerId === club.id && o.status === 'pending' && (!playerId || o.playerId === playerId),
    ) ?? [];
  return (
    <section className="incoming-offers">
      {offers.length > 0 && (
        <div className="incoming-offers-heading">
          <div>
            <span className="eyebrow">MESA DE NEGOCIAÇÕES</span>
            <h2>Propostas recebidas</h2>
            <p>Analise seu atleta e decida o próximo passo da transferência.</p>
          </div>
          <span className="offer-status">{offers.length} pendentes</span>
        </div>
      )}
      {!offers.length && (
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
        {offers.map((o) => {
          const player = snapshot.state.players.byId[o.playerId];
          const buyer = snapshot.state.clubs.byId[o.buyerId];
          const difference = player ? o.fee - player.marketValue.cents : 0;
          return (
            <article className="incoming-offer" key={o.id}>
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
                <span className="offer-status">Em análise</span>
              </header>
              <div className="offer-body">
                {player && (
                  <PlayerCard
                    player={player}
                    clubName={club.name}
                    kit={clubKit(club)}
                    modifier={effectiveOverall(snapshot.state, player) - player.overall}
                  />
                )}
                <div className="incoming-offer-details">
                  <span className="eyebrow">PROPOSTA DE COMPRA</span>
                  <h3>{player?.name ?? 'Jogador indisponível'}</h3>
                  {player && (
                    <p>
                      {positionLabel(player.position)} · {player.age} anos · {club.name}
                    </p>
                  )}
                  <div className="offer-amount">
                    <span>Valor oferecido</span>
                    <strong>{currency(o.fee)}</strong>
                    {player && (
                      <small>
                        Valor de mercado: {currency(player.marketValue.cents)}
                        <br />
                        Salário atual no clube: {currency(player.salary.cents)}/mês
                      </small>
                    )}
                  </div>
                  {player && (
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
                  Aceitar venda
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
