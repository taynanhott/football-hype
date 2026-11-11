import { expect, it } from 'vitest';
import { createWorld } from '@football/domain';
import { awardNews } from '../src/features/market/award-news';
import { ownNewsKeys } from '../src/features/market/news-notifications';
import { IDS, unwrap } from '../../../tests/fixtures/domain';

it('publica o técnico do mês no noticiário sem incluí-lo na gala anual', () => {
  const state = unwrap(
    createWorld({
      id: IDS.league,
      userId: IDS.user,
      name: 'Notícias',
      mode: 'offline',
      now: Date.UTC(2026, 0, 1, 3),
    }),
  );
  const club = state.clubs.byId[state.participants[0]!.clubId]!;
  state.monthlyCoachAwards = [
    {
      season: 2026,
      month: '2026-01',
      awardedAt: Date.UTC(2026, 1, 1, 3),
      coachUserId: IDS.user,
      coachName: 'Treinador campeão',
      clubId: club.id,
      clubName: club.name,
      score: 48,
      games: 3,
      wins: 3,
      draws: 0,
      losses: 0,
    },
  ];
  const news = awardNews(state).find((n) => n.id === 'coach-month:2026:2026-01')!;
  expect(news.title).toContain('técnico do mês de janeiro de 2026');
  expect(news.body).toContain('3 vitórias');
  expect(news.body).toContain('Série A (80)');
  expect(news.homeId).toBe(club.id);
  expect(ownNewsKeys(state, club.id)).toContain(news.id);
  expect(state.seasonAwards ?? []).toEqual([]);
});
