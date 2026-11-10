import { markNotificationsSeen } from '../../ui/use-navigation-notifications';
import { useScoutingReport } from '../players/use-scouting-report';
import { countryContinent } from './market-filters';
import { CountryFlag } from '../../ui/country-flag';
import { marketValue, transferMoney } from '../../ui/format';
import { PixelBadge } from '../../ui/pixel-badge';
import { PlayerModal } from '../players/player-modal';
import { usePlayerPresentation } from '../../ui/use-player-presentation';
import { Select, Option } from '../../ui/select';
import { positionLabel } from '../../ui/position-label';
import { NegotiationChat } from './negotiation-chat';
import { MoneyRange } from '../../ui/money-range';
import { IncomingOffers } from '../players/player-management';
import {
  contractEnd,
  maxContractYears,
  signingSalary,
  renewalTerms,
  loanTerms,
  transferContext,
  interestLabel,
  financialLimits,
  SearchTrie,
} from '@football/domain';
import { useEffect, useMemo, useState, useRef, useTransition, useCallback } from 'react';
import type { PlayerSnapshot } from '@football/shared';
import type { ViewProps } from '../../ui/view-props';
import { useGameStore } from '../../store/game-store';
import {
  defaultMarketFilters,
  UNLIMITED_MARKET_PRICE,
  marketPriceCeiling,
  matchesMarketRanges,
} from './market-filters';
import type { MarketFilterValues } from './market-filters';
import { MarketFiltersDialog } from './market-filters-dialog';
import { currency } from '../../ui/format';
import { Icon } from '../../ui/icons';

import { Portrait } from '../players/pixel-portrait';
import { NegotiationRestaurant } from './negotiation-restaurant';
import { PlayerDetails } from '../players/player-details';
import { clubKit, roundMoney, ceilMoney, formatMoneyFull, MONEY_STEPS } from '@football/shared';

const SORT_OPTIONS: Record<string, string> = {
  overall: 'Maior overall',
  interest: 'Mais interessado',
  age: 'Mais jovens',
  ageDesc: 'Mais experientes',
  price: 'Menor valor de mercado',
  priceDesc: 'Maior valor de mercado',
  salary: 'Menor salário',
  salaryDesc: 'Maior salário',
  name: 'Nome · A–Z',
};
export function Market({ snapshot, club, center, stadium }: ViewProps) {
  const report = useScoutingReport();
  const renewalCount = club.playerIds.filter((id) => {
    const player = snapshot.state.players.byId[id];
    return (
      player &&
      !snapshot.state.management?.loans?.[id] &&
      renewalTerms(snapshot.state, player).demand
    );
  }).length;
  const proposalCount =
    snapshot.state.negotiations.filter((n) => n.sellerId === club.id && n.status === 'review')
      .length +
    renewalCount +
    (snapshot.state.management?.offers?.filter(
      (o) => o.sellerId === club.id && o.status === 'pending',
    ).length ?? 0);
  const reviewingOffers = snapshot.state.negotiations.filter(
    (n) => n.buyerId === club.id && n.status === 'review',
  );
  const hasCompetingOffer = (offer: (typeof reviewingOffers)[number]) =>
    snapshot.state.negotiations.some(
      (entry) =>
        entry.playerId === offer.playerId &&
        entry.buyerId !== club.id &&
        !entry.withdrawn &&
        (entry.status === 'review' || entry.status === 'salary'),
    );
  const hasCompetingOffers = reviewingOffers.some(hasCompetingOffer);
  const [searchQuery, setSearchQuery] = useState('');
  const appliedSearchQuery = useRef('');
  const [searchSeed, setSearchSeed] = useState('');
  const [newsPlayerId, setNewsPlayerId] = useState<string | null>(null);
  const [viewMode, setViewMode] = usePlayerPresentation();
  const [detailPlayer, setDetailPlayer] = useState<PlayerSnapshot | null>(null);
  const [meetingReady, setMeetingReady] = useState(false);
  const [tab, setTab] = useState(() =>
    new URLSearchParams(location.hash.split('?')[1]).get('tab') === 'proposals'
      ? 'Propostas'
      : 'Todos',
  );
  useEffect(() => {
    if (tab === 'Propostas') {
      markNotificationsSeen(snapshot.state, club.id, 'market');
      markNotificationsSeen(snapshot.state, club.id, 'renewal');
    }
    if (tab === 'Pendente') markNotificationsSeen(snapshot.state, club.id, 'pending');
  }, [tab, snapshot.state, club.id]);
  const [prospects, setProspects] = useState(false);
  const [sector, setSector] = useState('ALL');
  const [affordable, setAffordable] = useState(false);
  const [bargains, setBargains] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  function selectQuickFilter(filter: 'affordable' | 'bargains' | 'prospects' | 'favorites') {
    setAffordable(filter === 'affordable' && !affordable);
    setBargains(filter === 'bargains' && !bargains);
    setProspects(filter === 'prospects' && !prospects);
    setFavoritesOnly(filter === 'favorites' && !favoritesOnly);
    setVisibleCount(48);
  }
  const [visibleCount, setVisibleCount] = useState(48);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadArmed = useRef(true);
  const applySearchQuery = useCallback((query: string) => {
    if (appliedSearchQuery.current === query) return;
    appliedSearchQuery.current = query;
    loadArmed.current = true;
    setSearchQuery(query);
    setVisibleCount(48);
  }, []);
  const [loadingMore, startLoadMore] = useTransition();
  const isOwnPlayer = (player: PlayerSnapshot) =>
    player.clubId === club.id || snapshot.state.management?.loans?.[player.id]?.ownerId === club.id;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState('overall');
  const [advancedFilters, setAdvancedFilters] = useState<MarketFilterValues>({
    overall: [1, 99],
    age: [16, 45],
    price: [0, UNLIMITED_MARKET_PRICE],
    interestedPlayers: false,
    interestedClubs: false,
  });
  const [interestedPlayers, setInterestedPlayers] = useState(false);
  const [interestedClubs, setInterestedClubs] = useState(false);
  const [overall, setOverall] = useState([1, 99]);
  const [age, setAge] = useState([16, 45]);
  const [price, setPrice] = useState([0, UNLIMITED_MARKET_PRICE]);
  const openedNewsLink = useRef<string | null>(null);
  useEffect(() => {
    const openPlayer = () => {
      if (openedNewsLink.current === location.hash) return;
      const params = new URLSearchParams(location.hash.split('?')[1]);
      const playerId = params.get('player');
      const player = snapshot.state.players.byId[playerId ?? ''];
      if (!player) return;
      openedNewsLink.current = location.hash;
      const review = params.get('tab') === 'review';
      setTab(review ? 'Pendente' : 'Todos');
      setViewMode('cards');
      if (!review) {
        setNewsPlayerId(player.id);
        appliedSearchQuery.current = player.name;
        setSearchQuery(player.name);
        setSearchSeed(player.name);
        setProspects(false);
        setFavoritesOnly(false);
        setOverall([1, 99]);
        setAge([16, 45]);
        setPrice([0, UNLIMITED_MARKET_PRICE]);
        setInterestedPlayers(false);
        setInterestedClubs(false);
        setVisibleCount(48);
      }
      setDetailPlayer(player);
      if (review)
        requestAnimationFrame(() => {
          document
            .getElementById('review-player-' + player.id)
            ?.scrollIntoView({ block: 'center' });
        });
    };
    openPlayer();
    window.addEventListener('hashchange', openPlayer);
    return () => window.removeEventListener('hashchange', openPlayer);
  }, [snapshot.state.id, snapshot.state.players.byId, setViewMode]);
  const allPlayers = useMemo(
    () => Object.values(snapshot.state.players.byId),
    [snapshot.state.players.byId],
  );
  const priceCeiling = useMemo(() => marketPriceCeiling(allPlayers), [allPlayers]);
  const hasFilters =
    overall[0] !== 1 ||
    overall[1] !== 99 ||
    age[0] !== 16 ||
    age[1] !== 45 ||
    price[0] !== 0 ||
    price[1] !== UNLIMITED_MARKET_PRICE ||
    interestedPlayers ||
    interestedClubs ||
    Boolean(advancedFilters.situation && advancedFilters.situation !== 'all') ||
    Boolean(advancedFilters.position && advancedFilters.position !== 'ALL') ||
    Boolean(advancedFilters.continent && advancedFilters.continent !== 'all') ||
    Boolean(
      advancedFilters.salary &&
      (advancedFilters.salary[0] !== 0 || advancedFilters.salary[1] !== UNLIMITED_MARKET_PRICE),
    );
  function applyFilters(filters: MarketFilterValues) {
    setAdvancedFilters(filters);
    setOverall(filters.overall);
    setAge(filters.age);
    setPrice(filters.price);
    setInterestedPlayers(filters.interestedPlayers);
    setInterestedClubs(filters.interestedClubs);
    setVisibleCount(48);
    setFiltersOpen(false);
  }
  function changeMarketTab(nextTab: string) {
    if (nextTab === 'Propostas' || nextTab === 'Pendente') {
      applyFilters(defaultMarketFilters());
      setSector('ALL');
      setAffordable(false);
      setBargains(false);
      setProspects(false);
      setFavoritesOnly(false);
      setSearchSeed('');
      applySearchQuery('');
    }
    setTab(nextTab);
  }
  const favoritesKey = 'market-favorites:' + snapshot.state.id + ':' + club.id;
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(favoritesKey) ?? '[]');
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  });
  function toggleFavorite(id: string) {
    if (snapshot.state.players.byId[id] && isOwnPlayer(snapshot.state.players.byId[id]!)) return;
    const next = favorites.includes(id)
      ? favorites.filter((value) => value !== id)
      : [...favorites, id];
    setFavorites(next);
    localStorage.setItem(favoritesKey, JSON.stringify(next));
  }

  const [withdrawPlayerId, setWithdrawPlayerId] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlayerSnapshot | null>(null);
  const [fee, setFee] = useState('');
  const [salary, setSalary] = useState('');
  const [contractYears, setContractYears] = useState(3);
  const send = useGameStore((state) => state.send);
  const busy = useGameStore((state) => state.busy);
  const searchIndex = useMemo(() => {
    const trie = new SearchTrie();
    for (const player of allPlayers) {
      trie.insert(player.name, player.id);
      for (const token of player.name.split(' ')) trie.insert(token, player.id);
    }
    return trie;
  }, [allPlayers]);
  const found =
    searchQuery.length > 1
      ? searchIndex
          .search(searchQuery)
          .slice(0, 50)
          .flatMap((id) => {
            const player = snapshot.state.players.byId[id];
            return player ? [player] : [];
          })
      : allPlayers;
  const linkedPlayer = newsPlayerId ? snapshot.state.players.byId[newsPlayerId] : undefined;
  const exactNewsSearch = linkedPlayer && searchQuery === linkedPlayer.name;
  const searchResults = exactNewsSearch ? [linkedPlayer] : found;
  const transferBudget = financialLimits(snapshot.state, club).transfer;
  const contexts = useMemo(() => {
    if (sortBy !== 'interest' && !bargains && !interestedPlayers && !interestedClubs)
      return new Map<string, ReturnType<typeof transferContext>>();
    return new Map(
      allPlayers.map((player) => [player.id, transferContext(snapshot.state, player, club)]),
    );
  }, [allPlayers, snapshot.state, club, sortBy, bargains, interestedPlayers, interestedClubs]);
  const contextFor = (player: PlayerSnapshot) =>
    contexts.get(player.id) ?? transferContext(snapshot.state, player, club);
  const candidates = searchResults
    .filter(
      (player) =>
        (!snapshot.state.management?.loans?.[player.id] || isOwnPlayer(player)) &&
        (exactNewsSearch || !player.academyClubId || !!player.clubId),
    )
    .filter((player) => {
      const seller = snapshot.state.clubs.byId[player.clubId ?? ''];
      const positions =
        sector === 'GK'
          ? ['GK']
          : sector === 'DEF'
            ? ['CB', 'RB', 'LB', 'LWB', 'RWB']
            : sector === 'MEI'
              ? ['DM', 'CM', 'AM', 'LM', 'RM']
              : ['ST', 'SS', 'LW', 'RW'];
      if (sector !== 'ALL' && !positions.includes(player.position)) return false;
      if (affordable && player.marketValue.cents > transferBudget) return false;
      if (
        bargains &&
        (contextFor(player).blocked || contextFor(player).minimumFee >= player.marketValue.cents)
      )
        return false;
      if (favoritesOnly && !favorites.includes(player.id)) return false;
      if (prospects) {
        const reach = player.id.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % 5;
        if (!(
          player.age <= 23 &&
          (report(player).hidden || (report(player).maximum ?? 0) >= 70) &&
          reach < center.levels.scouting
        ))
          return false;
      }
      if (tab === 'Todos' || tab === 'Propostas') return true;
      if (tab === 'Livres') return !player.clubId;
      if (tab === 'Exterior') return Boolean(seller && seller.country !== 'BR');
      return seller?.country === 'BR' && seller.division === tab;
    });
  const filterCandidates = (filters: MarketFilterValues) =>
    candidates
      .filter((player) =>
        matchesMarketRanges(
          player,
          report(player).hidden ? [1, 99] : filters.overall,
          filters.age,
          filters.price,
        ),
      )
      .filter((player) => {
        if (filters.position && filters.position !== 'ALL' && player.position !== filters.position)
          return false;
        if (
          filters.continent &&
          filters.continent !== 'all' &&
          countryContinent(player.nationality) !== filters.continent
        )
          return false;
        const dailySalary = player.salary.cents / 100 / 30;
        if (
          filters.salary &&
          (dailySalary < filters.salary[0]! || dailySalary > filters.salary[1]!)
        )
          return false;
        if (filters.situation === 'free' && player.clubId) return false;
        if (
          filters.situation === 'sale' &&
          !snapshot.state.management?.policies?.[player.id]?.available
        )
          return false;
        if (
          filters.situation === 'loan' &&
          !snapshot.state.management?.policies?.[player.id]?.loanAvailable
        )
          return false;
        if (
          filters.situation === 'expiring' &&
          (!player.clubId ||
            contractEnd(snapshot.state, player) - snapshot.state.lastProcessedAt > 180 * 86400000)
        )
          return false;
        if (!filters.interestedPlayers && !filters.interestedClubs) return true;
        const context = contextFor(player);
        return (
          (!filters.interestedPlayers || context.playerInterest > 0) &&
          (!filters.interestedClubs || (!context.blocked && context.clubInterest > 0))
        );
      });
  const matchingPlayers = filterCandidates({
    ...advancedFilters,
    overall,
    age,
    price,
    interestedPlayers,
    interestedClubs,
  }).sort((a, b) => {
    let difference = 0;
    switch (sortBy) {
      case 'interest':
        difference = contextFor(b).playerInterest - contextFor(a).playerInterest;
        break;
      case 'age':
        difference = a.age - b.age;
        break;
      case 'ageDesc':
        difference = b.age - a.age;
        break;
      case 'price':
        difference = a.marketValue.cents - b.marketValue.cents;
        break;
      case 'priceDesc':
        difference = b.marketValue.cents - a.marketValue.cents;
        break;
      case 'salary':
        difference = a.salary.cents - b.salary.cents;
        break;
      case 'salaryDesc':
        difference = b.salary.cents - a.salary.cents;
        break;
      case 'name':
        difference = a.name.localeCompare(b.name, 'pt-BR');
        break;
      default:
        difference = (Number(report(b).overall) || 0) - (Number(report(a).overall) || 0);
    }
    return difference || a.name.localeCompare(b.name, 'pt-BR');
  });
  const players = matchingPlayers.slice(
    0,
    prospects && searchQuery.length < 2 ? 8 + center.levels.scouting * 8 : visibleCount,
  );
  const hasMorePlayers = !prospects && matchingPlayers.length > visibleCount;
  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMorePlayers || loadingMore) return;
    let requested = false;
    let scrollFrame = 0;
    const load = () => {
      if (!loadArmed.current || requested) return;
      const rect = node.getBoundingClientRect();
      if (rect.top > window.innerHeight + 160 || rect.bottom < 0) return;
      loadArmed.current = false;
      requested = true;
      startLoadMore(() => setVisibleCount((count) => count + 48));
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) load();
      },
      { rootMargin: '160px' },
    );
    const arm = () => {
      loadArmed.current = true;
      load();
    };
    const onScroll = () => {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        arm();
      });
    };
    const key = (event: KeyboardEvent) => {
      if (['ArrowDown', 'PageDown', 'End', ' '].includes(event.key)) arm();
    };
    observer.observe(node);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('wheel', arm, { passive: true });
    window.addEventListener('touchmove', arm, { passive: true });
    window.addEventListener('pointerdown', arm, { passive: true });
    window.addEventListener('keydown', key);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(scrollFrame);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('wheel', arm);
      window.removeEventListener('touchmove', arm);
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', key);
    };
  }, [hasMorePlayers, loadingMore, visibleCount, viewMode, tab]);
  const negotiation = [...snapshot.state.negotiations]
    .reverse()
    .find(
      (offer) =>
        offer.playerId === selected?.id &&
        offer.buyerId === club.id &&
        ((offer.status === 'salary' &&
          (offer.expiresAt ?? Infinity) > snapshot.state.lastProcessedAt) ||
          offer.status === 'completed'),
    );
  function choose(player: PlayerSnapshot) {
    if (isOwnPlayer(player)) return;
    if (
      player.clubId &&
      financialLimits(snapshot.state, club).transfer <= 0 &&
      !loanTerms(snapshot.state, player, club).available
    ) {
      useGameStore.setState({
        error: 'Defina um orçamento para transferências antes de iniciar uma compra.',
      });
      return;
    }
    setSelected(player);
    setContractYears(
      snapshot.state.negotiations.find(
        (offer) =>
          offer.playerId === player.id && offer.buyerId === club.id && offer.status === 'salary',
      )?.contractYears ?? Math.min(3, maxContractYears(player.age)),
    );
    setMeetingReady(
      snapshot.state.negotiations.some(
        (n) =>
          n.playerId === player.id &&
          n.buyerId === club.id &&
          n.status === 'salary' &&
          (n.expiresAt ?? Infinity) > snapshot.state.lastProcessedAt,
      ),
    );
    const context = transferContext(snapshot.state, player, club);
    setFee(String(roundMoney(player.marketValue.cents, MONEY_STEPS.transfer) / 100));
    setSalary(
      String(Math.min(context.minimumSalary, financialLimits(snapshot.state, club).salary) / 100),
    );
  }
  const selectedContext = selected ? transferContext(snapshot.state, selected, club) : null;
  const lastReply = [...snapshot.state.negotiations]
    .reverse()
    .find((n) => n.playerId === selected?.id && n.buyerId === club.id);
  const negotiationError = useGameStore((s) => s.error);
  const blockedUntil = lastReply?.blockedUntil ?? 0;
  const salaryStage = Boolean(
    (negotiation && (meetingReady || negotiation.status === 'completed')) ||
    (selected && !selected.clubId),
  );
  const budgetLimits = financialLimits(
    snapshot.state,
    club,
    negotiation?.fee ?? 0,
    negotiation?.id,
  );
  const feeMaximum = budgetLimits.transfer;
  const demandedSalary = signingSalary(
    Math.min(
      (selected?.salary.cents ?? 0) * 3,
      negotiation?.baseMinimumSalary ??
        negotiation?.minimumSalary ??
        selectedContext?.minimumSalary ??
        0,
    ),
    contractYears,
  );
  const salaryStep = MONEY_STEPS.salary;
  const salaryMaximum = Math.max(
    demandedSalary,
    Math.floor(((selected?.salary.cents ?? 0) * 3) / salaryStep) * salaryStep,
  );
  const salaryCents = Math.max(0, roundMoney(Number(salary) * 100, salaryStep));
  const transferMinimum = 0;
  const transferMaximum = selected?.clubId
    ? Math.min(feeMaximum, ceilMoney(selected.marketValue.cents * 2.5, MONEY_STEPS.transfer))
    : 0;
  const feeCents = Math.max(
    transferMinimum,
    Math.min(
      feeMaximum,
      Math.floor((Number(fee) * 100) / MONEY_STEPS.general) * MONEY_STEPS.general,
    ),
  );
  return (
    <div className="transfer-hub">
      {withdrawPlayerId && (
        <PlayerModal
          title="Retirar proposta?"
          className="withdraw-offer-confirm"
          onClose={() => setWithdrawPlayerId(null)}
        >
          <p>
            Deseja retirar sua oferta por{' '}
            <strong>{snapshot.state.players.byId[withdrawPlayerId]?.name ?? 'este jogador'}</strong>
            ?
          </p>
          <p>
            Você ficará impedido de fazer uma nova proposta por esse jogador durante{' '}
            <strong>7 dias do calendário do jogo</strong>.
          </p>
          <div className="review-offer-actions">
            <button className="secondary" onClick={() => setWithdrawPlayerId(null)}>
              Manter oferta
            </button>
            <button
              className="withdraw-offer-button"
              disabled={busy}
              onClick={() => {
                send({ type: 'offer', playerId: withdrawPlayerId, fee: 0, withdraw: true });
                setWithdrawPlayerId(null);
              }}
            >
              Sim, retirar oferta
            </button>
          </div>
        </PlayerModal>
      )}
      <div className="page-heading transfer-hero">
        <div className="transfer-wallet">
          <span>Disponível para contratar</span>
          <strong>{currency(feeMaximum)}</strong>
          <small>Caixa do clube · {currency(club.balance.cents)}</small>
        </div>
      </div>
      <section
        className="market-controls market-collapsible-controls panel"
        aria-label="Filtros de transferências"
      >
        <div className="segmented market-tabs" role="group" aria-label="Categorias de jogadores">
          {['Todos', 'A', 'B', 'C', 'Exterior', 'Livres', 'Propostas', 'Pendente'].map((value) => (
            <button
              key={value}
              className={tab === value ? 'selected' : ''}
              aria-pressed={tab === value}
              onClick={() => {
                changeMarketTab(value);
                setVisibleCount(48);
              }}
            >
              {['A', 'B', 'C'].includes(value) ? 'Série ' + value : value}
              {value === 'Pendente' && hasCompetingOffers && (
                <span
                  className="offer-notification-dot"
                  aria-label="Outro clube está negociando com o jogador"
                />
              )}
              {value === 'Pendente' && (
                <span className="transfer-count">
                  {
                    snapshot.state.negotiations.filter(
                      (n) => n.buyerId === club.id && n.status === 'review',
                    ).length
                  }
                </span>
              )}
              {value === 'Propostas' && proposalCount > 0 && (
                <span className="transfer-alert-dot" aria-label="Há propostas recebidas" />
              )}
              {value === 'Propostas' && <span className="transfer-count">{proposalCount}</span>}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="market-expand-toggle"
          disabled={tab === 'Propostas' || tab === 'Pendente'}
          aria-expanded={filtersOpen && tab !== 'Propostas' && tab !== 'Pendente'}
          aria-controls="market-expanded-filters"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <Icon name="chevron-down" size={14} />
          <span>
            {filtersOpen && tab !== 'Propostas' && tab !== 'Pendente'
              ? 'Recolher filtros'
              : 'Filtros avançados'}
          </span>
        </button>
        {tab !== 'Propostas' && tab !== 'Pendente' && (
          <div
            className="market-filter-expansion"
            id="market-expanded-filters"
            data-expanded={filtersOpen}
            inert={!filtersOpen}
            aria-hidden={!filtersOpen}
          >
            <div className="market-reference-controls">
              <div className="market-position-tabs" role="group" aria-label="Posições">
                {[
                  ['ALL', 'Todas'],
                  ['GK', 'GOL'],
                  ['DEF', 'DEF'],
                  ['MEI', 'MEI'],
                  ['ATA', 'ATA'],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={sector === value}
                    className={sector === value ? 'selected' : ''}
                    onClick={() => {
                      setSector(value!);
                      setVisibleCount(48);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="market-quick-filters" role="group" aria-label="Atalhos de busca">
                <button
                  type="button"
                  className={affordable ? 'selected' : ''}
                  aria-pressed={affordable}
                  onClick={() => {
                    selectQuickFilter('affordable');
                  }}
                >
                  Cabem no bolso
                </button>
                <button
                  type="button"
                  className={bargains ? 'selected' : ''}
                  aria-pressed={bargains}
                  title="Negociação abaixo do valor de mercado"
                  onClick={() => {
                    selectQuickFilter('bargains');
                  }}
                >
                  Barganhas
                </button>
                <button
                  type="button"
                  className={prospects ? 'selected' : ''}
                  aria-pressed={prospects}
                  onClick={() => {
                    selectQuickFilter('prospects');
                  }}
                >
                  Jovens promessas
                </button>
                <button
                  type="button"
                  className={favoritesOnly ? 'selected' : ''}
                  aria-pressed={favoritesOnly}
                  onClick={() => {
                    if (tab === 'Propostas' || tab === 'Pendente') changeMarketTab('Todos');
                    selectQuickFilter('favorites');
                  }}
                >
                  ☆ Favoritos
                </button>
              </div>
              <MarketFiltersDialog
                overallAvailable={center.levels.scouting >= 2}
                key={JSON.stringify({ advancedFilters, overall, age, price })}
                value={{
                  ...advancedFilters,
                  overall,
                  age,
                  price,
                  interestedPlayers,
                  interestedClubs,
                }}
                salaryCeiling={Math.max(
                  100,
                  Math.ceil(Math.max(...allPlayers.map((p) => p.salary.cents / 3000)) / 100) * 100,
                )}
                priceCeiling={priceCeiling}
                countResults={(filters) => {
                  const count = filterCandidates(filters).length;
                  return prospects && searchQuery.length < 2
                    ? Math.min(count, 8 + center.levels.scouting * 8)
                    : count;
                }}
                onApply={applyFilters}
                onClose={() => setFiltersOpen(false)}
              />
            </div>
          </div>
        )}
      </section>
      <div className="market-result-toolbar">
        <div className="transfer-searchbar">
          <PlayerSearch key={searchSeed} initialQuery={searchSeed} onSearch={applySearchQuery} />
        </div>

        <label className="market-sort-label">
          <Select
            aria-label="Ordenar jogadores"
            menuMinWidth={200}
            value={sortBy}
            onValueChange={(value) => {
              setSortBy(value);
              setVisibleCount(48);
            }}
          >
            {Object.entries(SORT_OPTIONS).map(([value, label]) => (
              <Option key={value} value={value}>
                {label}
              </Option>
            ))}
          </Select>
        </label>
      </div>
      {players.length > 0 && tab !== 'Propostas' && tab !== 'Pendente' && (
        <div className="market-listing-switch">
          {' '}
          <div className="market-view-toggle" role="group" aria-label="Visualização dos jogadores">
            <button
              className="secondary"
              aria-pressed={viewMode === 'cards'}
              onClick={() => setViewMode('cards')}
            >
              Cartas
            </button>
            <button
              className="secondary"
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
            >
              Lista
            </button>
          </div>
        </div>
      )}
      {tab === 'Pendente' ? (
        <section
          className="incoming-offers incoming-offers-review"
          data-presentation="list"
          aria-label="Propostas enviadas pendentes"
        >
          <div className="incoming-offers-grid">
            {snapshot.state.negotiations
              .filter((n) => n.buyerId === club.id && n.status === 'review')
              .sort((a, b) => (a.reviewAt ?? 0) - (b.reviewAt ?? 0))
              .map((offer) => {
                const player = snapshot.state.players.byId[offer.playerId];
                const seller = snapshot.state.clubs.byId[offer.sellerId ?? ''];
                return (
                  <article
                    className="incoming-offer"
                    id={'review-player-' + offer.playerId}
                    key={offer.id}
                  >
                    <header className="offer-buyer">
                      <Icon name="handshake" size={26} />
                      <strong>{seller?.name ?? 'Clube vendedor'}</strong>
                      <span className="offer-status">
                        {hasCompetingOffer(offer) && (
                          <span
                            className="offer-notification-dot"
                            aria-label="Outro clube está negociando com o jogador"
                          />
                        )}
                        Pendente
                      </span>
                      <span className="offer-review-days">
                        {Math.max(
                          0,
                          Math.ceil(
                            ((offer.reviewAt ?? snapshot.state.lastProcessedAt) -
                              snapshot.state.lastProcessedAt) /
                              86400000,
                          ),
                        )}{' '}
                        dias restantes
                      </span>
                    </header>
                    <div className="offer-body">
                      {player && (
                        <button
                          type="button"
                          className="offer-list-portrait market-player-card-trigger"
                          aria-label={`Abrir carta de ${player?.name}`}
                          onClick={() => player && setDetailPlayer(player)}
                        >
                          <Portrait
                            player={player}
                            clubName={seller?.name ?? ''}
                            kit={clubKit(seller)}
                          />
                        </button>
                      )}
                      <div className="incoming-offer-details">
                        <h3>
                          <button
                            type="button"
                            className="market-player-name-trigger"
                            onClick={() => player && setDetailPlayer(player)}
                          >
                            {player?.name ?? 'Jogador'}
                          </button>
                        </h3>
                        <div className="offer-amount">
                          <span>Sua oferta</span>
                          <strong>{transferMoney(offer.fee)}</strong>
                          {!!offer.exchangePlayerIds?.length && (
                            <p className="review-exchange-players">
                              Jogadores oferecidos:{' '}
                              {offer.exchangePlayerIds
                                .map(
                                  (id) =>
                                    snapshot.state.players.byId[id]?.name ?? 'Jogador indisponível',
                                )
                                .join(', ')}
                              <br />
                              Crédito na troca: {transferMoney(offer.exchangeValue ?? 0)} · Total:{' '}
                              {transferMoney(offer.fee + (offer.exchangeValue ?? 0))}
                            </p>
                          )}
                          {hasCompetingOffer(offer) && (
                            <p className="negative">
                              Outro clube também está negociando com o jogador.
                            </p>
                          )}
                        </div>
                        <p>
                          Decisão:{' '}
                          {offer.reviewAt
                            ? new Date(offer.reviewAt).toLocaleDateString('pt-BR', {
                                timeZone: 'America/Sao_Paulo',
                              })
                            : 'Aguardando análise'}
                        </p>
                      </div>
                    </div>
                    <footer className="offer-actions review-offer-actions">
                      <button
                        className="negotiate-button"
                        onClick={() => {
                          if (player) {
                            choose(player);
                            setFee(String(offer.fee / 100));
                          }
                        }}
                      >
                        Aumentar proposta
                      </button>
                      <button
                        className="withdraw-offer-button"
                        disabled={busy}
                        onClick={() => setWithdrawPlayerId(offer.playerId)}
                      >
                        Retirar oferta
                      </button>
                    </footer>
                  </article>
                );
              })}
          </div>
          {!snapshot.state.negotiations.some(
            (n) => n.buyerId === club.id && n.status === 'review',
          ) && (
            <div className="offers-empty-state">
              <span className="offers-empty-icon">
                <Icon name="handshake" size={30} />
              </span>
              <div>
                <strong>Nenhuma proposta em análise</strong>
                <p>
                  As ofertas que você enviar aos clubes aparecerão aqui durante a semana de
                  avaliação.
                </p>
              </div>
            </div>
          )}
        </section>
      ) : tab === 'Propostas' ? (
        <IncomingOffers snapshot={snapshot} club={club} center={center} stadium={stadium} />
      ) : (
        <>
          {viewMode === 'list' ? (
            <div
              className="market-player-list market-reference-list"
              role="list"
              aria-label="Jogadores no mercado"
            >
              {players.map((player) => {
                const playerClub = snapshot.state.clubs.byId[player.clubId ?? ''];
                const context = transferContext(snapshot.state, player, club);
                const tier = report(player).tier;
                return (
                  <div
                    className="market-list-row"
                    role="listitem"
                    key={player.id}
                    onClick={() => setDetailPlayer(player)}
                  >
                    <strong
                      className="market-list-overall"
                      data-tier={tier}
                      aria-label={`Overall ${report(player).overall}`}
                    >
                      {report(player).overall}
                    </strong>
                    <Portrait
                      player={player}
                      clubName={playerClub?.name ?? 'Sem clube'}
                      kit={clubKit(playerClub)}
                    />
                    <div className="market-list-identity">
                      <button onClick={() => setDetailPlayer(player)}>
                        <CountryFlag country={player.nationality} /> {player.name}
                      </button>
                      <span>
                        {positionLabel(player.position)} · {playerClub?.name ?? 'Sem clube'}
                      </span>
                      <span className="market-list-summary">
                        {player.age} anos ·{' '}
                        <b
                          className="market-list-potential"
                          aria-label={`Potencial: ${report(player).potential}`}
                          title="Potencial"
                        >
                          {report(player).potential}
                        </b>
                      </span>
                    </div>
                    <strong className="market-list-price">
                      {'HC$ ' + Math.ceil(player.marketValue.cents / 100).toLocaleString('pt-BR')}
                    </strong>
                    <div className="market-list-interest">
                      <div>
                        <span>
                          Jogador · <strong>{interestLabel(context.playerInterest)}</strong>
                        </span>
                        <meter
                          min={0}
                          max={100}
                          value={context.playerInterest}
                          aria-label="Interesse do jogador"
                        />
                      </div>
                      {player.clubId && (
                        <div>
                          <span>
                            Clube ·{' '}
                            <strong>
                              {player.clubId ? interestLabel(context.clubInterest) : 'Sem clube'}
                            </strong>
                          </span>
                          {player.clubId && (
                            <meter
                              min={0}
                              max={100}
                              value={context.clubInterest}
                              aria-label="Interesse do clube"
                            />
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      className="market-list-negotiate"
                      disabled={
                        isOwnPlayer(player) ||
                        (context.blocked && !loanTerms(snapshot.state, player, club).available)
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        choose(player);
                      }}
                    >
                      {isOwnPlayer(player) ||
                      (context.blocked && !loanTerms(snapshot.state, player, club).available)
                        ? isOwnPlayer(player)
                          ? 'Seu jogador'
                          : 'Bloqueado'
                        : 'Negociar ↗'}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className="market-grid incoming-offers market-league-offers"
              data-presentation="list"
            >
              {players.map((player) => {
                const seller = snapshot.state.clubs.byId[player.clubId ?? ''];
                const context = transferContext(snapshot.state, player, club);
                return (
                  <article className="incoming-offer" key={player.id}>
                    <header className="offer-buyer">
                      <PixelBadge
                        name={seller?.name ?? 'Sem clube'}
                        {...(seller?.crestUrl ? { url: seller.crestUrl } : {})}
                        size={32}
                      />
                      <div>
                        <span>CLUBE DO JOGADOR</span>
                        {seller ? (
                          <a href={'#/trophies?club=' + seller.id}>{seller.name} ↗</a>
                        ) : (
                          <strong>Sem clube</strong>
                        )}
                      </div>
                      <span
                        className="offer-status market-overall-badge"
                        data-tier={report(player).tier}
                      >
                        {report(player).hidden ? '?' : `${report(player).overall} OVR`}
                      </span>
                    </header>
                    <div className="offer-body">
                      <button
                        type="button"
                        className="offer-list-portrait market-player-card-trigger"
                        aria-label={`Abrir carta de ${player.name}`}
                        onClick={() => setDetailPlayer(player)}
                      >
                        <Portrait
                          player={player}
                          clubName={seller?.name ?? 'Sem clube'}
                          kit={clubKit(seller)}
                        />
                        <span
                          className="market-portrait-potential"
                          aria-label={`Potencial: ${report(player).potential}`}
                        >
                          {report(player).potential}
                        </span>
                      </button>
                      <div className="incoming-offer-details">
                        <span className="eyebrow">JOGADOR NO MERCADO</span>
                        <h3>
                          <button
                            type="button"
                            className="market-player-name-trigger"
                            onClick={() => setDetailPlayer(player)}
                          >
                            {player.name}
                          </button>
                        </h3>
                        <p>
                          {positionLabel(player.position)} ·{' '}
                          {<CountryFlag country={player.nationality} />} · {player.age} anos
                        </p>
                        <div className="offer-amount">
                          <span>Valor de mercado</span>
                          <strong>{marketValue(player.marketValue.cents)}</strong>
                          <small>Salário atual no clube: {currency(player.salary.cents)}/mês</small>
                        </div>
                        <InterestBars context={context} showClub={Boolean(player.clubId)} />
                      </div>
                    </div>
                    <footer className="offer-actions">
                      <button
                        className="negotiate-button"
                        disabled={
                          isOwnPlayer(player) ||
                          (context.blocked && !loanTerms(snapshot.state, player, club).available)
                        }
                        onClick={() => choose(player)}
                      >
                        {isOwnPlayer(player)
                          ? 'Seu jogador'
                          : context.blocked && !loanTerms(snapshot.state, player, club).available
                            ? 'Bloqueado'
                            : 'Iniciar negociação ↗'}
                      </button>

                      <button
                        className="secondary market-favorite-action"
                        disabled={isOwnPlayer(player)}
                        aria-pressed={favorites.includes(player.id)}
                        onClick={() => toggleFavorite(player.id)}
                      >
                        {favorites.includes(player.id) ? '★ Favoritado' : '☆ Favoritar'}
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
          {hasMorePlayers && (
            <div
              className="market-infinite-loading"
              ref={loadMoreRef}
              role="status"
              aria-live="polite"
              aria-busy={loadingMore}
            >
              {loadingMore ? (
                'Carregando jogadores…'
              ) : (
                <span aria-hidden="true">Mais jogadores abaixo</span>
              )}
            </div>
          )}
          {!players.length && (
            <div className="market-empty-state" role="status">
              <Icon name="shield" size={18} />
              <span>
                {hasFilters
                  ? 'Nenhum atleta encontrado com os filtros atuais. Expanda os filtros, ajuste a busca e veja os resultados.'
                  : 'Nenhum atleta encontrado para esta busca.'}
              </span>
            </div>
          )}
        </>
      )}
      {detailPlayer && (
        <PlayerDetails
          player={detailPlayer}
          club={snapshot.state.clubs.byId[detailPlayer.clubId ?? '']}
          onClose={() => setDetailPlayer(null)}
        />
      )}

      {selected && !salaryStage ? (
        <NegotiationChat
          snapshot={snapshot}
          club={club}
          onContinue={() => setMeetingReady(true)}
          player={selected}
          value={feeCents}
          maximum={feeMaximum}
          minimumOffer={transferMinimum}
          maximumOffer={transferMaximum}
          onValue={(value) => setFee(String(value / 100))}
          onClose={() => setSelected(null)}
        />
      ) : (
        selected && (
          <div
            className="modal-backdrop market-negotiation-backdrop"
            onClick={() => setSelected(null)}
          >
            <section
              className={`modal negotiation-experience ${salaryStage ? 'contract-folder' : 'negotiation-phone'}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="negotiation-title"
              onClick={(event) => event.stopPropagation()}
            >
              {salaryStage && <NegotiationRestaurant />}
              <button
                className="close-modal"
                aria-label="Fechar negociação"
                onClick={() => setSelected(null)}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
              <span className="eyebrow">
                {salaryStage ? 'CONTRATO PROFISSIONAL' : 'LIGAÇÃO · DIRETORIA'}
              </span>
              <h2 id="negotiation-title">{selected.name}</h2>
              <>
                {salaryStage ? (
                  <div className="contract-sheet">
                    <span>ACORDO DE TRABALHO</span>
                    <h3>{club.name}</h3>
                    <p>
                      Atleta: <strong>{selected.name}</strong>
                    </p>
                    <p>
                      Salário mensal:{' '}
                      <strong>{currency(negotiation?.offeredSalary ?? salaryCents)}</strong>
                    </p>
                    {negotiation?.status === 'completed' ? (
                      <p>
                        Duração:{' '}
                        <strong>
                          {negotiation.contractYears ?? contractYears}{' '}
                          {(negotiation.contractYears ?? contractYears) === 1 ? 'ano' : 'anos'}
                        </strong>
                      </p>
                    ) : (
                      <fieldset className="contract-duration-picker" disabled={busy}>
                        <legend>Duração do contrato</legend>
                        <div>
                          {[1, 2, 3, 4, 5].map((years) => (
                            <button
                              key={years}
                              type="button"
                              aria-pressed={contractYears === years}
                              onClick={() => setContractYears(years)}
                            >
                              {years} {years === 1 ? 'ano' : 'anos'}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                    )}
                    <div className="contract-signature-field">
                      {negotiation?.status === 'completed' && (
                        <>
                          <span className="contract-signature">{selected.name}</span>
                          <svg
                            className="contract-full-pen"
                            viewBox="0 0 32 140"
                            aria-hidden="true"
                          >
                            <path d="M10 10Q16 0 22 10V102H10Z" fill="#233b49" />
                            <path d="M10 18H22V28H10Z" fill="#c6b175" />
                            <path d="M22 12H27V60" fill="none" stroke="#c6b175" strokeWidth="3" />
                            <path d="M10 102H22L16 132Z" fill="#c6b175" />
                            <path d="M14 124H18L16 138Z" fill="#263238" />
                            <path d="M13 30V96" stroke="#547181" strokeWidth="2" />
                          </svg>
                        </>
                      )}
                      <div className="contract-signature-line">Assinatura do atleta</div>
                    </div>
                  </div>
                ) : (
                  <div className="phone-contact">
                    <span aria-hidden="true">☎</span>
                    <strong>
                      {snapshot.state.clubs.byId[selected.clubId ?? '']?.name ?? 'Diretoria'}
                    </strong>
                    <small>Negociação de transferência</small>
                  </div>
                )}
                {salaryStage && (
                  <figure className="contract-player-seat">
                    <Portrait player={selected} clubName={club.name} kit={clubKit(club)} />
                    <figcaption>{selected.name}</figcaption>
                  </figure>
                )}
                {!salaryStage && selectedContext && (
                  <InterestBars context={selectedContext} showClub={Boolean(selected.clubId)} />
                )}
                <div
                  className={
                    salaryStage
                      ? 'renewal-player-speech market-player-speech is-waiting'
                      : 'phone-notification'
                  }
                  role="status"
                  aria-live="polite"
                >
                  <strong>{salaryStage ? selected.name : 'Mensagem da diretoria'}</strong>
                  <p>
                    {negotiation?.status === 'completed'
                      ? 'Combinado! Contrato assinado. Estou pronto para vestir a camisa do clube.'
                      : (negotiationError ??
                        (salaryStage
                          ? negotiation?.salaryFirm
                            ? `Quero ${currency(demandedSalary)} por mês para ${contractYears} ${contractYears === 1 ? 'ano' : 'anos'}. Esse é meu valor final.`
                            : `Para assinar por ${contractYears} ${contractYears === 1 ? 'ano' : 'anos'}, peço ${currency(demandedSalary)} por mês. Qual é sua oferta?`
                          : lastReply?.status === 'rejected'
                            ? lastReply.reply
                            : 'Estamos ouvindo. Quanto vocês oferecem pelo jogador?'))}
                  </p>
                </div>
                {!salaryStage && lastReply?.status === 'rejected' && (
                  <p className="negotiation-counter">
                    Ofertas muito baixas: {lastReply.lowAttempts ?? 0}/3 · Contrapropostas:{' '}
                    {lastReply.closeAttempts ?? 0}/3
                  </p>
                )}
                {lastReply?.status === 'review' && (
                  <p className="offer-status" role="status">
                    Proposta em análise até{' '}
                    {new Date(lastReply.reviewAt ?? 0).toLocaleDateString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                    })}
                    . O clube escolherá a melhor oferta antes de liberar a conversa com o jogador.
                  </p>
                )}
                {salaryStage && negotiation?.status !== 'completed' && negotiation?.expiresAt && (
                  <p className="negotiation-counter">
                    Acordo com o clube válido por mais{' '}
                    {Math.max(
                      0,
                      Math.ceil(
                        (negotiation.expiresAt - snapshot.state.lastProcessedAt) / 86400000,
                      ),
                    )}{' '}
                    dias do jogo.
                  </p>
                )}
                {negotiation?.status === 'completed' ? (
                  <button className="primary full" onClick={() => setSelected(null)}>
                    Concluir contratação
                  </button>
                ) : (
                  <>
                    <label className="negotiation-range">
                      <span>
                        {salaryStage ? 'Sua oferta de salário / mês' : 'Sua oferta ao clube'}
                        <output>{currency(salaryStage ? salaryCents : feeCents)}</output>
                      </span>
                      <MoneyRange
                        aria-label={salaryStage ? 'Oferta salarial' : 'Oferta de transferência'}
                        min={0}
                        max={salaryStage ? salaryMaximum : feeMaximum}
                        step={salaryStage ? salaryStep : MONEY_STEPS.general}
                        value={salaryStage ? salaryCents : feeCents}
                        disabled={busy}
                        onChange={(e) =>
                          salaryStage
                            ? setSalary(String(Number(e.target.value) / 100))
                            : setFee(String(Number(e.target.value) / 100))
                        }
                      />
                      <small>
                        Disponível: {currency(salaryStage ? salaryMaximum : feeMaximum)}
                      </small>
                    </label>
                    <div className="contract-actions">
                      {salaryStage && (
                        <button
                          className="secondary full"
                          disabled={
                            busy ||
                            salaryCents <= 0 ||
                            Boolean(negotiation?.salaryFirm && salaryCents < demandedSalary)
                          }
                          title={
                            negotiation?.salaryFirm && salaryCents < demandedSalary
                              ? 'O jogador recusou o desconto e mantém a exigência informada.'
                              : undefined
                          }
                          onClick={() => {
                            useGameStore.getState().clearError();
                            if (negotiation)
                              send({
                                type: 'salary',
                                negotiationId: negotiation.id,
                                salary: salaryCents,
                                years: contractYears,
                              });
                            else
                              send({
                                type: 'sign-free',
                                playerId: selected.id,
                                salary: salaryCents,
                                years: contractYears,
                              });
                          }}
                        >
                          <span>Enviar minha proposta</span>
                          <strong>
                            {formatMoneyFull(salaryCents)}
                            <small>/mês</small>
                          </strong>
                        </button>
                      )}
                      <button
                        className="primary full"
                        disabled={
                          busy ||
                          lastReply?.status === 'review' ||
                          (salaryStage && demandedSalary > salaryMaximum) ||
                          (!salaryStage &&
                            (blockedUntil > snapshot.state.lastProcessedAt ||
                              selectedContext?.blocked))
                        }
                        onClick={() => {
                          useGameStore.getState().clearError();
                          if (salaryStage) {
                            if (negotiation)
                              send({
                                type: 'salary',
                                negotiationId: negotiation.id,
                                salary: demandedSalary,
                                years: contractYears,
                              });
                            else
                              send({
                                type: 'sign-free',
                                playerId: selected.id,
                                salary: demandedSalary,
                                years: contractYears,
                              });
                          } else send({ type: 'offer', playerId: selected.id, fee: feeCents });
                        }}
                      >
                        {busy ? (
                          'Aguardando resposta…'
                        ) : salaryStage ? (
                          <>
                            <span>Aceitar exigência</span>
                            <strong>
                              {formatMoneyFull(demandedSalary)}
                              <small>/mês</small>
                            </strong>
                          </>
                        ) : blockedUntil > snapshot.state.lastProcessedAt ? (
                          'Conversas suspensas por uma semana'
                        ) : (
                          'Enviar proposta'
                        )}
                      </button>
                    </div>
                  </>
                )}
              </>
            </section>
          </div>
        )
      )}
    </div>
  );
}

function PlayerSearch({
  onSearch,
  initialQuery,
}: {
  onSearch: (query: string) => void;
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  useEffect(() => {
    const timer = setTimeout(() => onSearch(query.trim()), 500);
    return () => clearTimeout(timer);
  }, [query, onSearch]);
  return (
    <label className="search-label">
      <input
        aria-label="Buscar atleta por nome ou sobrenome"
        placeholder="Nome ou sobrenome…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSearch(query.trim());
        }}
      />
    </label>
  );
}

function InterestBars({
  context,
  showClub = true,
}: {
  context: ReturnType<typeof transferContext>;
  showClub?: boolean;
}) {
  return (
    <div className="interest-bars">
      {[
        { label: 'Clube', score: context.clubInterest, player: false },
        { label: 'Jogador', score: context.playerInterest, player: true },
      ]
        .filter((item) => showClub || item.player)
        .map((item) => (
          <div key={item.label}>
            <span>
              {item.label} · {interestLabel(item.score)}
            </span>
            <meter
              min="0"
              max="100"
              value={item.score}
              data-interest={item.score < 35 ? 'low' : item.score < 65 ? 'medium' : 'high'}
              aria-label={'Interesse do ' + item.label.toLowerCase()}
            />
          </div>
        ))}
    </div>
  );
}
