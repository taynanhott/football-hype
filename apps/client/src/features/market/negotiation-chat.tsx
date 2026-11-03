import { marketValue, transferMoney } from '../../ui/format';
import { Portrait } from '../players/player-card';
import { openModalPreservingScroll } from '../../ui/modal-scroll';
import { GeneratedPerson } from '../../ui/person-avatar';
import { useEffect, useRef, useState } from 'react';
import type { ViewProps } from '../../ui/view-props';
import { transferContext, interestLabel, loanTerms, exchangeCandidates } from '@football/domain';
import type { PlayerSnapshot } from '@football/shared';
import { MONEY_STEPS, ceilMoney } from '@football/shared';
import { currency } from '../../ui/format';
import { MoneyRange } from '../../ui/money-range';
import { useGameStore } from '../../store/game-store';

export function NegotiationChat({
  snapshot,
  club,
  player,
  value,
  maximum,
  minimumOffer,
  maximumOffer,
  onValue,
  onClose,
  onContinue,
}: Pick<ViewProps, 'snapshot' | 'club'> & {
  player: PlayerSnapshot;
  value: number;
  maximum: number;
  minimumOffer: number;
  maximumOffer: number;
  onValue: (value: number) => void;
  onClose: () => void;
  onContinue: () => void;
}) {
  const offerDisplay =
    'HC$ ' + (value / 100000).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const loanCloseTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(loanCloseTimer.current), []);
  useEffect(() => openModalPreservingScroll(dialogRef.current), []);
  const [phoneTime, setPhoneTime] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setPhoneTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seller = snapshot.state.clubs.byId[player.clubId ?? ''];
  const loan = loanTerms(snapshot.state, player, club);
  const [dealType, setDealType] = useState<'buy' | 'loan' | null>(
    maximum <= 0 && loan.available ? 'loan' : 'buy',
  );
  const [loanPercent, setLoanPercent] = useState(100);
  const [loanMonths, setLoanMonths] = useState(6);
  const [exchangeIds, setExchangeIds] = useState<string[]>(
    () =>
      snapshot.state.negotiations
        .filter((n) => n.playerId === player.id && n.buyerId === club.id && n.status === 'review')
        .at(-1)?.exchangePlayerIds ?? [],
  );
  const [exchangeExpanded, setExchangeExpanded] = useState(false);
  const candidates = exchangeCandidates(snapshot.state, club.id, player.clubId ?? '').sort(
    (a, b) => b.value - a.value || a.player.name.localeCompare(b.player.name, 'pt-BR'),
  );
  const exchangeValue = candidates
    .filter((c) => exchangeIds.includes(c.player.id))
    .reduce((sum, c) => sum + c.value, 0);
  const context = transferContext(snapshot.state, player, club);
  const history = snapshot.state.negotiations.filter(
    (n) => n.playerId === player.id && n.buyerId === club.id,
  );
  const last = history.at(-1);
  const rival = snapshot.state.negotiations
    .filter((n) => n.playerId === player.id && n.buyerId !== club.id && n.status === 'review')
    .sort((a, b) => b.fee - a.fee)[0];
  const currentOffer = history.find((n) => n.status === 'review');
  const [introCount, setIntroCount] = useState(history.length ? 3 : 0);
  const [budgetVisible, setBudgetVisible] = useState(history.length > 0);
  const [replyCount, setReplyCount] = useState(history.length);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const busy = useGameStore((s) => s.busy);
  const error = useGameStore((s) => s.error);
  const bottom = useRef<HTMLDivElement>(null);
  const blocked = (last?.blockedUntil ?? 0) > snapshot.state.lastProcessedAt;
  const typing = introCount < 3 || replyCount < history.length || busy || awaitingReply;
  useEffect(() => {
    if (introCount < 3) return;
    const timer = window.setTimeout(() => setBudgetVisible(true), 500);
    return () => window.clearTimeout(timer);
  }, [introCount]);
  useEffect(() => {
    if (introCount < 3) {
      const timer = window.setTimeout(() => setIntroCount((count) => count + 1), 500);
      return () => window.clearTimeout(timer);
    }
    if (replyCount < history.length) {
      const timer = window.setTimeout(() => {
        setReplyCount((count) => count + 1);
        setAwaitingReply(false);
      }, 1000);
      return () => window.clearTimeout(timer);
    }
  }, [introCount, replyCount, history.length]);
  const responseKey = JSON.stringify(
    history.map((n) => [n.id, n.status, n.reply, n.fee, n.exchangePlayerIds, n.exchangeValue]),
  );
  const sentResponseKey = useRef(responseKey);
  useEffect(() => {
    if (!awaitingReply || responseKey === sentResponseKey.current) return;
    const timer = window.setTimeout(() => {
      setReplyCount(history.length);
      setAwaitingReply(false);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [responseKey, awaitingReply, history.length]);
  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setAwaitingReply(false), 1000);
    return () => window.clearTimeout(timer);
  }, [error]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [history.length, error, busy, introCount, replyCount, budgetVisible]);
  return (
    <dialog
      ref={dialogRef}
      className="negotiation-chat-dialog"
      aria-label="Negociação com o técnico"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="chat-phone-shell">
        <span className="chat-phone-side-key volume" aria-hidden="true" />
        <span className="chat-phone-side-key power" aria-hidden="true" />
        <section
          className="modal negotiation-chat"
          role="dialog"
          aria-modal="true"
          aria-labelledby="chat-contact"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="chat-phone-status" aria-hidden="true">
            <span>
              {phoneTime.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Sao_Paulo',
              })}
            </span>
            <i />
            <span>▴ ▰ 85% ▮</span>
          </div>
          <header className="chat-header">
            <button onClick={onClose} aria-label="Fechar conversa">
              ←
            </button>
            <span className="chat-avatar" aria-hidden="true">
              <GeneratedPerson name={seller?.coachName ?? 'Técnico do clube'} />
            </span>
            <div>
              <strong id="chat-contact">
                {seller?.coachName ?? `Técnico do ${seller?.name ?? 'clube'}`}
              </strong>
              <small>
                {seller?.name} · {typing ? 'digitando…' : 'Negociação de jogador'}
              </small>
            </div>
            <span className="chat-contact-menu" aria-hidden="true">
              ⋮
            </span>
          </header>
          <div
            className="chat-history"
            role="log"
            aria-label="Histórico da negociação"
            tabIndex={0}
          >
            <span className="chat-date">Conversa sobre {player.name}</span>
            {introCount >= 1 && (
              <div className="chat-bubble incoming">
                Olá! Vamos conversar sobre {player.name}.{' '}
                {loan.available ? 'Você prefere empréstimo ou compra?' : 'Qual é sua proposta?'}
              </div>
            )}
            {introCount >= 2 && (
              <div className="chat-bubble incoming">
                Hoje, o valor de mercado do {player.name} é {marketValue(player.marketValue.cents)},
                mas queremos negociar um valor melhor por ele. Vamos ouvir sua proposta.
              </div>
            )}
            {introCount >= 3 && (
              <div className="chat-bubble incoming">
                {loan.available && (
                  <>
                    Aceitamos conversar sobre compra ou empréstimo. No empréstimo, o mínimo é{' '}
                    {loan.minimumPercent}% do salário e o prazo máximo é{' '}
                    {loan.maxMonths >= 12 ? '1 temporada' : '6 meses'}.{' '}
                  </>
                )}
                Nosso interesse em vender é {interestLabel(context.clubInterest).toLowerCase()}. O
                interesse do jogador é {interestLabel(context.playerInterest).toLowerCase()}.{' '}
              </div>
            )}
            {budgetVisible && (
              <div className="chat-bubble outgoing">
                Tenho até {currency(maximum)} disponíveis para a transferência.
              </div>
            )}
            {history.map((n, index) => (
              <div className="chat-exchange" key={n.id}>
                <div className="chat-bubble outgoing">
                  {n.withdrawn
                    ? 'Decidi retirar minha oferta pelo jogador.'
                    : n.revised
                      ? 'Decidi mudar a oferta, ofereço ' + currency(n.fee) + ' pelo jogador.'
                      : 'Ofereço ' +
                        currency(n.fee) +
                        ' pela transferência de ' +
                        player.name +
                        '.'}
                  {Boolean(n.exchangePlayerIds?.length) && (
                    <p>
                      Inclui{' '}
                      {n.exchangePlayerIds
                        ?.map((id) => snapshot.state.players.byId[id]?.name)
                        .join(', ')}{' '}
                      · Crédito {currency(n.exchangeValue ?? 0)} · Total{' '}
                      {currency(n.fee + (n.exchangeValue ?? 0))}
                    </p>
                  )}
                  <small>Enviada ✓✓</small>
                </div>
                {index < replyCount && (
                  <div className="chat-bubble incoming">
                    {n.reply ??
                      (n.status === 'salary'
                        ? 'Gostamos da oferta, vamos marcar um horário com nosso jogador.'
                        : 'Proposta analisada.')}
                  </div>
                )}
              </div>
            ))}
            {currentOffer && rival && rival.fee > currentOffer.fee && (
              <div className="chat-bubble incoming">
                Recebemos uma oferta melhor de {currency(rival.fee)} pelo jogador. Qual sua
                contraproposta?
              </div>
            )}
            {context.blocked && dealType === 'buy' && (
              <div className="chat-bubble incoming">
                Não estamos disponíveis para negociar esse jogador.
              </div>
            )}
            {error && (
              <div className="chat-bubble incoming" role="alert">
                {error}
              </div>
            )}
            {(typing || (budgetVisible && last?.status !== 'salary')) && (
              <div
                className={`chat-bubble ${typing ? 'incoming' : 'outgoing'} chat-typing`}
                aria-label={typing ? 'Técnico digitando' : 'Preparando proposta'}
              >
                <span aria-hidden="true">•</span>
                <span aria-hidden="true">•</span>
                <span aria-hidden="true">•</span>
              </div>
            )}
            <div ref={bottom} />
          </div>
          {budgetVisible && (
            <div className="chat-deal-options" role="group" aria-label="Tipo de negociação">
              <button
                disabled={!loan.available}
                title={!loan.available ? 'Empréstimo indisponível para este atleta' : undefined}
                aria-pressed={dealType === 'loan'}
                onClick={() => setDealType('loan')}
              >
                Empréstimo
              </button>
              <button
                disabled={maximum <= 0}
                title={maximum <= 0 ? 'Defina um orçamento para transferências' : undefined}
                aria-pressed={dealType === 'buy'}
                onClick={() => setDealType('buy')}
              >
                Compra
              </button>
            </div>
          )}
          {dealType === 'loan' ? (
            <div className="chat-loan-composer">
              <label>
                Parte do salário:{' '}
                <strong>
                  {loanPercent}% ·{' '}
                  {currency(
                    ceilMoney((player.salary.cents * loanPercent) / 100, MONEY_STEPS.salary),
                  )}
                  /mês
                </strong>
                <MoneyRange
                  aria-label="Percentual do salário"
                  min={50}
                  max={100}
                  step={25}
                  value={loanPercent}
                  onChange={(e) => setLoanPercent(Number(e.target.value))}
                />
              </label>
              <div className="segmented" role="group" aria-label="Duração do empréstimo">
                {[6, 12].map((months) => (
                  <button
                    key={months}
                    disabled={months > loan.maxMonths}
                    aria-pressed={loanMonths === months}
                    onClick={() => setLoanMonths(months)}
                  >
                    {months === 6 ? '6 meses' : '1 temporada'}
                  </button>
                ))}
              </div>
              <button
                className="primary full"
                disabled={typing || loanPercent < loan.minimumPercent}
                onClick={() => {
                  const id = useGameStore.getState().send({
                    type: 'management',
                    action: 'offer-loan',
                    playerId: player.id,
                    months: loanMonths,
                    salaryPercent: loanPercent as 50 | 75 | 100,
                  });
                  if (id) {
                    sentResponseKey.current = responseKey;
                    setAwaitingReply(true);
                    loanCloseTimer.current = window.setTimeout(onClose, 1000);
                  }
                }}
              >
                Oferecer empréstimo
              </button>
            </div>
          ) : dealType === null ? null : !typing &&
            last?.status === 'salary' &&
            (last.expiresAt ?? Infinity) > snapshot.state.lastProcessedAt ? (
            <div className="chat-composer">
              <button
                className="primary full"
                style={{ width: '100%', borderRadius: 12, fontSize: 13 }}
                onClick={onContinue}
              >
                Conversar com o jogador →
              </button>
            </div>
          ) : (
            <form
              className={`chat-composer transfer-proposal-composer ${exchangeExpanded ? 'exchange-expanded' : ''}`}
              onSubmit={(e) => {
                e.preventDefault();
                useGameStore.getState().clearError();
                setAwaitingReply(true);
                setExchangeExpanded(false);
                const request = useGameStore.getState().send({
                  type: 'offer',
                  playerId: player.id,
                  fee: value,
                  exchangePlayerIds: exchangeIds,
                });
                if (!request) setAwaitingReply(false);
              }}
            >
              <div className="transfer-cash-control">
                <span>Valor em dinheiro</span>
                <div className="transfer-value-stepper">
                  <button
                    type="button"
                    aria-label="Diminuir oferta"
                    disabled={typing || blocked}
                    onClick={() =>
                      onValue(Math.max(minimumOffer, value - MONEY_STEPS.transferSlider / 2))
                    }
                  >
                    −
                  </button>
                  <strong>{offerDisplay}</strong>
                  <button
                    type="button"
                    aria-label="Aumentar oferta"
                    disabled={typing || blocked}
                    onClick={() =>
                      onValue(Math.min(maximumOffer, value + MONEY_STEPS.transferSlider / 2))
                    }
                  >
                    +
                  </button>
                </div>
                <small>
                  {Math.round(
                    ((value + exchangeValue) / Math.max(1, player.marketValue.cents)) * 100,
                  )}
                  % do valor de mercado · Caixa {currency(maximum)}
                </small>
                <MoneyRange
                  aria-label="Valor da proposta"
                  min={minimumOffer}
                  max={maximumOffer}
                  step={MONEY_STEPS.transferSlider / 2}
                  value={value}
                  onChange={(e) =>
                    onValue(
                      Math.min(
                        maximumOffer,
                        Math.max(
                          minimumOffer,
                          Math.round(Number(e.target.value) / MONEY_STEPS.transferSlider) *
                            MONEY_STEPS.transferSlider,
                        ),
                      ),
                    )
                  }
                  disabled={typing || !budgetVisible || blocked || context.blocked}
                />
              </div>
              {seller && (
                <details
                  className="exchange-picker"
                  open={exchangeExpanded}
                  onToggle={(event) => setExchangeExpanded(event.currentTarget.open)}
                >
                  <summary>
                    ⇄ Incluir jogadores na troca <strong>{exchangeIds.length}/3</strong>
                  </summary>
                  <div className="exchange-options">
                    {candidates.length ? (
                      candidates.map(({ player: candidate, value: credit }) => (
                        <label key={candidate.id}>
                          <input
                            type="checkbox"
                            checked={exchangeIds.includes(candidate.id)}
                            disabled={
                              typing ||
                              (exchangeIds.length >= 3 && !exchangeIds.includes(candidate.id))
                            }
                            onChange={(event) =>
                              setExchangeIds((ids) =>
                                event.target.checked
                                  ? [...ids, candidate.id]
                                  : ids.filter((id) => id !== candidate.id),
                              )
                            }
                          />
                          <Portrait player={candidate} clubName={club.name} />
                          <span>
                            <b>{candidate.name}</b>
                            <small>
                              {candidate.position} · {candidate.age} anos · OVR {candidate.overall}
                            </small>
                          </span>
                          <strong>
                            {'HC$ ' + Math.ceil(credit / 100).toLocaleString('pt-BR')}
                          </strong>
                        </label>
                      ))
                    ) : (
                      <p>O clube não tem interesse nos atletas disponíveis.</p>
                    )}
                  </div>
                  <p>
                    Dinheiro: {transferMoney(value)} · Troca: {transferMoney(exchangeValue)}
                    <br />
                    <strong>Proposta total: {transferMoney(value + exchangeValue)}</strong>
                  </p>
                </details>
              )}
              <button
                type="submit"
                aria-label="Enviar proposta"
                disabled={
                  typing ||
                  !budgetVisible ||
                  blocked ||
                  context.blocked ||
                  maximum <= 0 ||
                  value > maximum ||
                  (last?.status === 'review' &&
                    value + exchangeValue <= last.fee + (last.exchangeValue ?? 0))
                }
              >
                Enviar proposta
              </button>
            </form>
          )}
          <div className="chat-phone-navigation" aria-hidden="true">
            <span />
          </div>
        </section>
      </div>
      <button type="button" className="modal-return" aria-label="Voltar" onClick={onClose}>
        ← Voltar
      </button>
    </dialog>
  );
}
