import { useEffect, useRef, useState } from 'react';
import { ceilMoney, MONEY_STEPS, type ClubSnapshot } from '@football/shared';
import { GeneratedPerson } from '../../ui/person-avatar';
import { MoneyRange } from '../../ui/money-range';
import { currency as offerMoney } from '../../ui/format';
import { openModalPreservingScroll } from '../../ui/modal-scroll';
import { clubCoachName } from '@football/domain';
import { useGameStore } from '../../store/game-store';

export function CounterOfferChat({
  buyer,
  playerName,
  originalFee,
  fee,
  submitted,
  result,
  busy,
  onValue,
  onClose,
  onSend,
}: {
  buyer: ClubSnapshot | undefined;
  playerName: string;
  originalFee: number;
  fee: number;
  submitted: boolean;
  result: string;
  busy: boolean;
  onValue: (fee: number) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const participants = useGameStore((store) => store.snapshot?.state.participants);
  const coachName = buyer
    ? clubCoachName({ participants: participants ?? [] }, buyer)
    : 'Técnico do clube';
  const [initialFee] = useState(originalFee);
  const step = MONEY_STEPS.transfer;
  const minimum = ceilMoney(initialFee + step, step);
  const maximum = Math.max(minimum + step, ceilMoney(initialFee * 3, step), ceilMoney(fee, step));
  const normalize = (value: number) => Math.max(minimum, Math.round(value / step) * step);
  const currentValue = normalize(fee);
  useEffect(() => openModalPreservingScroll(dialog.current), []);
  useEffect(() => {
    if (!submitted && fee !== currentValue) onValue(currentValue);
  }, [fee, currentValue, submitted, onValue]);
  const change = (value: number) => onValue(normalize(value));
  return (
    <dialog
      ref={dialog}
      className="negotiation-chat-dialog"
      aria-label="Contraoferta com o técnico"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="chat-phone-shell">
        <span className="chat-phone-side-key volume" aria-hidden="true" />
        <span className="chat-phone-side-key power" aria-hidden="true" />
        <section className="modal negotiation-chat" onClick={(e) => e.stopPropagation()}>
          <div className="chat-phone-status" aria-hidden="true">
            <span>
              {new Date().toLocaleTimeString('pt-BR', {
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
              <GeneratedPerson name={coachName} />
            </span>
            <div>
              <strong>{coachName}</strong>
              <small>{buyer?.name} · Negociação de jogador</small>
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
            <span className="chat-date">Conversa sobre {playerName}</span>
            <div className="chat-bubble incoming">
              Olá! Temos interesse em contratar {playerName}. Nossa proposta é de{' '}
              {offerMoney(initialFee)}. Podemos chegar a um acordo?
            </div>
            {submitted && (
              <>
                <div className="chat-bubble outgoing">Pedimos {offerMoney(fee)} pelo jogador.</div>
                <div className="chat-bubble incoming" role="status">
                  {result}
                </div>
              </>
            )}
          </div>
          <form
            className="chat-composer transfer-proposal-composer"
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy && !submitted && fee > initialFee) onSend();
            }}
          >
            <div className="transfer-cash-control">
              <span>Valor em dinheiro</span>
              <div className="transfer-value-stepper">
                <button
                  type="button"
                  aria-label="Diminuir oferta"
                  disabled={busy || submitted || currentValue <= minimum}
                  onClick={() => change(currentValue - step)}
                >
                  −
                </button>
                <strong>{offerMoney(fee)}</strong>
                <button
                  type="button"
                  aria-label="Aumentar oferta"
                  disabled={busy || submitted}
                  onClick={() => change(currentValue + step)}
                >
                  +
                </button>
              </div>
              <small>Contraoferta · Proposta recebida {offerMoney(initialFee)}</small>
              <MoneyRange
                aria-label="Valor da contraoferta"
                min={minimum}
                max={maximum}
                step={step}
                value={currentValue}
                disabled={busy || submitted}
                onChange={(event) => change(Number(event.target.value))}
              />
            </div>
            <button type="submit" disabled={busy || submitted || fee <= initialFee}>
              Enviar proposta
            </button>
          </form>
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
