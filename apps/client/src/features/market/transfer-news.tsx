import { useState } from 'react';
import type { WorldState, Negotiation } from '@football/shared';
import { PersonAvatar, type PersonAppearance } from '../../ui/person-avatar';
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
  const [query, setQuery] = useState('');
  const [exploring, setExploring] = useState(false);
  const [topic, setTopic] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'completed' | 'saved'>('all');
  const [saved, setSaved] = useState<string[]>([]);
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
  const tag = (name: string) => '#' + name.replace(/[^\p{L}\p{N}]/gu, '');
  const tagsFor = (item: (typeof news)[number]) => [
    ...new Set(
      [
        '#MercadoDaBola',
        state.players.byId[item.offer.playerId]?.name,
        state.clubs.byId[item.offer.buyerId]?.name,
        state.clubs.byId[item.offer.sellerId ?? '']?.name,
      ]
        .filter((name): name is string => Boolean(name))
        .map((name) => (name.startsWith('#') ? name : tag(name))),
    ),
  ];
  const topics = [...new Set(news.flatMap(tagsFor))]
    .map((hashtag) => ({
      hashtag,
      count: news.filter((item) => tagsFor(item).includes(hashtag)).length,
    }))
    .sort((a, b) => b.count - a.count || a.hashtag.localeCompare(b.hashtag));
  function openTopic(hashtag: string) {
    setTopic(hashtag);
    setQuery('');
    setFilter('all');
    setExploring(false);
  }
  const visible = news.filter(
    (item) =>
      (!topic || tagsFor(item).includes(topic)) &&
      (filter === 'all' ||
        (filter === 'saved' ? saved.includes(item.offer.id) : item.offer.status === 'completed')) &&
      (item.title + ' ' + item.body + ' ' + item.reporter.name)
        .toLocaleLowerCase('pt-BR')
        .includes(query.toLocaleLowerCase('pt-BR')),
  );
  const trending = [
    ...new Set(news.map((item) => state.players.byId[item.offer.playerId]?.name).filter(Boolean)),
  ].slice(0, 5);
  return (
    <section className="transfer-news-page twitter-news" aria-label="Noticiário de transferências">
      <nav className="news-left-nav" aria-label="Navegação do noticiário">
        <span className="news-network-logo" role="img" aria-label="Águia do noticiário">
          <svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true">
            <path
              fill="currentColor"
              d="M5 8c7 2 12 6 17 12l3-6c2-4 6-5 10-3l2 3 7 2-7 4c0 9-5 15-13 18l-10 3 4-8C10 30 5 25 2 19l11 5C8 19 6 14 5 8Z"
            />
            <path fill="#17232f" d="m31 14 3 1-3 1z" />
          </svg>
        </span>
        <button
          className={!exploring && filter === 'all' ? 'active' : ''}
          onClick={() => {
            setFilter('all');
            setQuery('');
            setExploring(false);
            setTopic(null);
          }}
        >
          <span>⌂</span> Início
        </button>
        <button
          className={exploring ? 'active' : ''}
          onClick={() => {
            setExploring(true);
            setTopic(null);
            setQuery('');
          }}
        >
          <span>#</span> Explorar
        </button>
        <button
          className={filter === 'completed' ? 'active' : ''}
          onClick={() => {
            setFilter('completed');
            setExploring(false);
            setTopic(null);
          }}
        >
          <span>♧</span> Negócios fechados
        </button>
        <button
          className={filter === 'saved' ? 'active' : ''}
          onClick={() => {
            setFilter('saved');
            setExploring(false);
            setTopic(null);
          }}
        >
          <span>♧</span> Itens salvos
        </button>
        <a href="#/market">
          <span>⇄</span> Transferências
        </a>
        <a href="#/squad">
          <span>♙</span> Elenco
        </a>
        <button
          className="news-tweet-button"
          onClick={() => {
            setQuery('');
            setFilter('all');
          }}
        >
          Ver notícias
        </button>
        <div className="news-nav-profile">
          <span className="transfer-reporter-avatar">
            <PersonAvatar profile={REPORTERS[0]!} />
          </span>
          <div>
            <strong>Mercado da bola</strong>
            <small>@noticiario</small>
          </div>
          <span>⌄</span>
        </div>
      </nav>
      <div className="transfer-news-panel">
        <header className="news-timeline-header">
          <strong>{exploring ? 'Explorar' : (topic ?? 'Início')}</strong>
          <span className="news-timeline-sparkle" aria-hidden="true">
            ✧
          </span>
        </header>
        <div className="news-composer">
          <span className="transfer-reporter-avatar">
            <PersonAvatar profile={REPORTERS[0]!} />
          </span>
          <div>
            <label htmlFor="news-search-input">O que está acontecendo no mercado?</label>
            <div className="news-composer-tools">
              <span aria-hidden="true">▧ ▤ ▥ ☺ ⚑</span>
              <button onClick={() => document.getElementById('news-search-input')?.focus()}>
                Explorar
              </button>
            </div>
          </div>
        </div>
        <div className="news-feed-count">
          {visible.length} notícias{' '}
          {filter === 'saved'
            ? 'salvas'
            : filter === 'completed'
              ? 'de negócios fechados'
              : 'do mercado'}
        </div>
        <div className="transfer-news-feed">
          {exploring && (
            <section className="news-explore-topics" aria-label="Hashtags dos assuntos do momento">
              <h3>Assuntos do momento</h3>
              {topics.length ? (
                topics
                  .filter((item) =>
                    item.hashtag
                      .toLocaleLowerCase('pt-BR')
                      .includes(query.toLocaleLowerCase('pt-BR')),
                  )
                  .map((item, index) => (
                    <button key={item.hashtag} onClick={() => openTopic(item.hashtag)}>
                      <small>{index + 1} · Mercado da bola</small>
                      <strong>{item.hashtag}</strong>
                      <span>
                        {item.count} {item.count === 1 ? 'publicação' : 'publicações'}
                      </span>
                    </button>
                  ))
              ) : (
                <p>As hashtags aparecem assim que houver movimentações na liga.</p>
              )}
            </section>
          )}
          {!exploring && (
            <>
              {!visible.length && (
                <div className="news-empty-state" role="status">
                  <span className="news-empty-icon" aria-hidden="true">
                    <svg
                      viewBox="0 0 32 32"
                      width="30"
                      height="30"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    >
                      <rect x="5" y="6" width="22" height="21" rx="3" />
                      <path d="M10 12h12M10 17h5M10 22h12M19 16h3v3h-3zM11 3v5M21 3v5" />
                    </svg>
                  </span>
                  <h3>
                    {query
                      ? 'Nenhum resultado encontrado'
                      : filter === 'saved'
                        ? 'Suas notícias favoritas ficam aqui'
                        : filter === 'completed'
                          ? 'Nenhum negócio fechado por enquanto'
                          : 'O mercado ainda está quieto'}
                  </h3>
                  <p>
                    {query
                      ? 'Tente buscar outro jogador, clube ou repórter.'
                      : filter === 'saved'
                        ? 'Toque em Salvar nas publicações para acompanhar depois.'
                        : 'Assim que a bola rolar nas negociações, as novidades da liga aparecem aqui.'}
                  </p>
                </div>
              )}
              {visible.map(({ offer, title, body, reporter }) => (
                <article className="transfer-news-item" key={offer.id}>
                  <div className="transfer-reporter-avatar">
                    <PersonAvatar profile={reporter} />
                  </div>
                  <div>
                    <div className="news-post-author">
                      <strong className="transfer-reporter-name">{reporter.name}</strong>
                      <span className="news-verified" aria-label="Repórter verificado">
                        ✓
                      </span>
                      <span className="news-handle">
                        @
                        {reporter.name
                          .toLowerCase()
                          .replaceAll(' ', '')
                          .normalize('NFD')
                          .replace(/[̀-ͯ]/g, '')}
                      </span>
                    </div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                    <small>
                      {offer.offeredAt
                        ? new Date(offer.offeredAt).toLocaleDateString('pt-BR', {
                            timeZone: 'America/Sao_Paulo',
                          })
                        : 'Temporada ' + state.season}
                    </small>
                    <div className="news-post-footer">
                      <button onClick={() => openTopic('#MercadoDaBola')}>#MercadoDaBola</button>
                      <button
                        aria-pressed={saved.includes(offer.id)}
                        aria-label={
                          saved.includes(offer.id) ? 'Remover notícia dos salvos' : 'Salvar notícia'
                        }
                        onClick={() =>
                          setSaved((previous) =>
                            previous.includes(offer.id)
                              ? previous.filter((id) => id !== offer.id)
                              : [...previous, offer.id],
                          )
                        }
                      >
                        {saved.includes(offer.id) ? '★ Salvo' : '☆ Salvar'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </>
          )}
        </div>
      </div>
      <aside className="news-discover" aria-label="Assuntos do mercado">
        <label className="news-search">
          <span aria-hidden="true">⌕</span>
          <input
            id="news-search-input"
            aria-label="Buscar notícias"
            placeholder="Buscar no noticiário"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <section className="news-trends">
          <h3>
            Assuntos para você <span aria-hidden="true">⚙</span>
          </h3>
          {trending.length ? (
            trending.map((name, index) => (
              <button key={name} onClick={() => setQuery(name ?? '')}>
                <small>{index + 1} · Mercado de transferências</small>
                <strong>{name}</strong>
                <span>Ver movimentações →</span>
              </button>
            ))
          ) : (
            <p>Aguardando movimentações na janela.</p>
          )}
        </section>
        <section className="news-reporters">
          <h3>Quem acompanhar</h3>
          {REPORTERS.map((reporter) => (
            <button key={reporter.name} onClick={() => setQuery(reporter.name)}>
              <span className="transfer-reporter-avatar">
                <PersonAvatar profile={reporter} />
              </span>
              <span>
                <strong>{reporter.name}</strong>
                <small>Repórter · Mercado da bola</small>
              </span>
              <span className="news-follow-label">Ver notícias</span>
            </button>
          ))}
        </section>
        <p className="news-discover-note">Notícias da sua liga · Últimas 20 movimentações</p>
      </aside>
    </section>
  );
}
