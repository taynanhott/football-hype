import { useEffect, useRef, useState } from 'react';
import type { ViewProps } from '../../ui/view-props';
import { transferContext, interestLabel } from '@football/domain';
import type { PlayerSnapshot } from '@football/shared';
import { MONEY_STEPS } from '@football/shared';
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
  const seller = snapshot.state.clubs.byId[player.clubId ?? ''];
  const context = transferContext(snapshot.state, player, club);
  const history = snapshot.state.negotiations.filter(
    (n) => n.playerId === player.id && n.buyerId === club.id,
  );
  const last = history.at(-1);
  const [introCount, setIntroCount] = useState(0);
  const [budgetVisible, setBudgetVisible] = useState(false);
  const [replyCount, setReplyCount] = useState(history.length);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const busy = useGameStore((s) => s.busy);
  const error = useGameStore((s) => s.error);
  const bottom = useRef<HTMLDivElement>(null);
  const blocked = (last?.blockedUntil ?? 0) > snapshot.state.lastProcessedAt;
  const typing = introCount < 3 || replyCount < history.length || busy || awaitingReply;
  useEffect(() => {
    if (introCount < 3) return;
    const timer = window.setTimeout(() => setBudgetVisible(true), 1000);
    return () => window.clearTimeout(timer);
  }, [introCount]);
  useEffect(() => {
    if (introCount < 3) {
      const timer = window.setTimeout(() => setIntroCount((count) => count + 1), 3000);
      return () => window.clearTimeout(timer);
    }
    if (replyCount < history.length) {
      const timer = window.setTimeout(() => {
        setReplyCount((count) => count + 1);
        setAwaitingReply(false);
      }, 3000);
      return () => window.clearTimeout(timer);
    }
  }, [introCount, replyCount, history.length]);
  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setAwaitingReply(false), 3000);
    return () => window.clearTimeout(timer);
  }, [error]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [history.length, error, busy, introCount, replyCount, budgetVisible]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal negotiation-chat"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-contact"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="chat-header">
          <button onClick={onClose} aria-label="Fechar conversa">
            ←
          </button>
          <span className="chat-avatar" aria-hidden="true">
            {(seller?.coachName ?? 'T').slice(0, 1)}
          </span>
          <div>
            <strong id="chat-contact">
              {seller?.coachName ?? `Técnico do ${seller?.name ?? 'clube'}`}
            </strong>
            <small>
              {seller?.name} · {typing ? 'digitando…' : 'Negociação de jogador'}
            </small>
          </div>
          <span aria-hidden="true">⋮</span>
        </header>
        <div className="chat-history" role="log" aria-label="Histórico da negociação" tabIndex={0}>
          <span className="chat-date">Conversa sobre {player.name}</span>
          {introCount >= 1 && (
            <div className="chat-bubble incoming">
              Olá! Vamos conversar sobre {player.name}. Qual é sua proposta?
            </div>
          )}
          {introCount >= 2 && (
            <div className="chat-bubble incoming">
              Hoje, o valor de mercado do {player.name} é {currency(player.marketValue.cents)}, mas
              queremos negociar um valor melhor por ele. Vamos ouvir sua proposta.
            </div>
          )}
          {introCount >= 3 && (
            <div className="chat-bubble incoming">
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
                Ofereço {currency(n.fee)} pela transferência de {player.name}.
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
          {context.blocked && (
            <div className="chat-bubble incoming">
              Não estamos disponíveis para negociar esse jogador.
            </div>
          )}
          {error && (
            <div className="chat-bubble incoming" role="alert">
              {error}
            </div>
          )}
          {typing && (
            <div className="chat-bubble incoming chat-typing" aria-label="Digitando">
              •••
            </div>
          )}
          <div ref={bottom} />
        </div>
        {!typing &&
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
            className="chat-composer"
            onSubmit={(e) => {
              e.preventDefault();
              useGameStore.getState().clearError();
              setAwaitingReply(true);
              useGameStore.getState().send({ type: 'offer', playerId: player.id, fee: value });
            }}
          >
            <label>
              <span>
                Oferecer <strong>{currency(value)}</strong>
              </span>
              <MoneyRange
                aria-label="Valor da proposta"
                min={minimumOffer}
                max={maximumOffer}
                step={MONEY_STEPS.general}
                value={value}
                onChange={(e) => onValue(Number(e.target.value))}
                disabled={typing || !budgetVisible || blocked || context.blocked}
              />
            </label>
            <button
              type="submit"
              aria-label="Enviar proposta"
              disabled={typing || !budgetVisible || blocked || context.blocked || value > maximum}
            >
              ➤
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
