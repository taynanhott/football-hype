import { useState } from 'react';
import type { WorldState, Negotiation } from '@football/shared';
import { PersonAvatar, type PersonAppearance } from '../../ui/person-avatar';
import { Icon } from '../../ui/icons';
import { currency } from '../../ui/format';

const REPORTERS: PersonAppearance[] = [
  {
    name: 'Cazé',
    skin: '#f0c9ac',
    hair: 'curto',
    hairColor: '#292322',
    beard: 'cheia',
    glasses: 'redondo',
    outfit: '#273c50',
    outfitStyle: 'camiseta',
  },
  {
    name: 'Pilhado',
    skin: '#edc3a3',
    hair: 'topete',
    hairColor: '#30241f',
    beard: 'nenhuma',
    outfit: '#344d35',
    outfitStyle: 'polo',
  },
  {
    name: 'Marcelo Bechler',
    skin: '#f3cfb4',
    hair: 'ondulado',
    hairColor: '#322721',
    beard: 'curta',
    outfit: '#343b54',
    outfitStyle: 'camisa',
  },
  {
    name: 'Fred Caldeira',
    skin: '#eec8ad',
    hair: 'curto',
    hairColor: '#292320',
    beard: 'curta',
    outfit: '#473a53',
    outfitStyle: 'polo',
  },
];
const OFFER_HEADLINES = [
  (b: string, p: string) => b + ' apresenta proposta por ' + p,
  (b: string, p: string) => b + ' abre negociações para contratar ' + p,
  (b: string, p: string) => 'Mercado em movimento: ' + b + ' faz oferta por ' + p,
  (b: string, p: string) => b + ' tenta avançar por ' + p,
  (b: string, p: string) => 'Na mesa da diretoria: proposta do ' + b + ' por ' + p,
  (b: string, p: string) => b + ' entra nas negociações por ' + p,
  (b: string, p: string) => 'Oferta enviada! ' + b + ' quer ' + p,
  (b: string, p: string) => b + ' busca um acordo por ' + p,
  (b: string, p: string) => 'Bastidores do mercado: ' + b + ' negocia por ' + p,
  (b: string, p: string) => b + ' coloca uma oferta na mesa por ' + p,
];
const COMPETITION_HEADLINES = [
  'também entrou na jogada por',
  'entrou na disputa por',
  'tem concorrência na corrida por',
  'esquenta as negociações por',
  'faz nova investida na disputa por',
  'também quer levar',
  'movimenta a concorrência por',
  'chega com uma oferta por',
  'aumenta a disputa pela contratação de',
  'entra na briga pela contratação de',
];
export function TransferNews({ state }: { state: WorldState }) {
  const [open, setOpen] = useState(false);
  const offers: Negotiation[] = [
    ...state.negotiations,
    ...(state.management?.offers ?? []).map((offer) => ({
      ...offer,
      offeredSalary: offer.salary,
      interest: 0,
      status:
        offer.status === 'pending'
          ? ('review' as const)
          : offer.status === 'accepted'
            ? ('completed' as const)
            : ('rejected' as const),
    })),
  ].sort((a, b) => (a.offeredAt ?? 0) - (b.offeredAt ?? 0));
  const news = offers
    .map((offer, index) => {
      const buyer = state.clubs.byId[offer.buyerId]?.name ?? 'Clube interessado';
      const seller = state.clubs.byId[offer.sellerId ?? '']?.name ?? 'o clube';
      const player = state.players.byId[offer.playerId]?.name ?? 'o jogador';
      const others = offers
        .slice(0, index)
        .filter(
          (n) => n.playerId === offer.playerId && n.buyerId !== offer.buyerId && !n.withdrawn,
        );
      const rival = others.at(-1);
      const rivalName = rival ? (state.clubs.byId[rival.buyerId]?.name ?? 'outro clube') : '';
      let title = OFFER_HEADLINES[index % OFFER_HEADLINES.length]!(buyer, player);
      let body = 'A oferta de ' + currency(offer.fee) + ' foi enviada ao ' + seller + '.';
      if (rival) {
        title =
          buyer + ' ' + COMPETITION_HEADLINES[index % COMPETITION_HEADLINES.length] + ' ' + player;
        body =
          buyer +
          ' ofereceu ' +
          currency(offer.fee) +
          '. O ' +
          rivalName +
          ' também apresentou proposta, de ' +
          currency(rival.fee) +
          '.';
      }
      if (offer.revised) {
        title = buyer + ' muda a oferta por ' + player;
        body = 'O novo valor apresentado é de ' + currency(offer.fee) + '.';
      }
      if (offer.status === 'review') body += ' A diretoria está analisando a proposta.';
      if (offer.status === 'salary') {
        title = seller + ' libera conversa com ' + player;
        body =
          'A proposta do ' +
          buyer +
          ', de ' +
          currency(offer.fee) +
          ', foi aceita pelo clube. Falta o acerto com o atleta.';
      }
      if (offer.status === 'completed') {
        title = 'Fechado: ' + player + ' vai para o ' + buyer;
        body =
          'Transferência concluída por ' +
          currency(offer.fee) +
          ', com contrato acertado entre clube e jogador.';
      }
      if (offer.withdrawn) {
        title = buyer + ' retira a oferta por ' + player;
        body = 'O clube desistiu da proposta. As conversas ficam suspensas por uma semana.';
      } else if (offer.status === 'rejected') body += ' Essa proposta não está mais em análise.';
      return { offer, title, body, reporter: REPORTERS[index % REPORTERS.length]! };
    })
    .slice(-20)
    .reverse();
  return (
    <aside
      className={'transfer-news ' + (open ? 'is-open' : '')}
      aria-label="Noticiário de transferências"
    >
      <button
        className="transfer-news-toggle"
        aria-expanded={open}
        aria-controls="transfer-news-feed"
        onClick={() => setOpen(!open)}
      >
        <Icon name="megaphone" size={20} />
        <span>Noticiário</span>
        <b>{news.length}</b>
      </button>
      {open && (
        <div className="transfer-news-panel" id="transfer-news-feed">
          <header>
            <strong>Giro do mercado</strong>
            <button aria-label="Fechar noticiário" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>
          <div className="transfer-news-feed">
            {!news.length && (
              <p className="transfer-news-empty">
                As movimentações de transferências da liga aparecerão aqui.
              </p>
            )}
            {news.map(({ offer, title, body, reporter }) => (
              <article className="transfer-news-item" key={offer.id}>
                <div className="transfer-reporter-avatar">
                  <PersonAvatar profile={reporter} />
                </div>
                <div>
                  <strong className="transfer-reporter-name">{reporter.name}</strong>
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <small>
                    {offer.offeredAt
                      ? new Date(offer.offeredAt).toLocaleDateString('pt-BR', {
                          timeZone: 'America/Sao_Paulo',
                        })
                      : 'Temporada ' + state.season}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
