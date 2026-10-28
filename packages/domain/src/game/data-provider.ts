import { competitionDates } from '../competitions/season-calendar.js';
import { initializeStartingChemistry } from './tactics.js';
import { mapResult } from '../core/result.js';
import { correctSerieC2026 } from './regularize-season.js';
import {
  worldDatasetSchema,
  worldStateSchema,
  type WorldDataset,
  type WorldState,
} from '@football/shared';
import { flatMapResult, type Result } from '../core/result.js';
import { parseBoundary } from '../core/validation.js';
import { isPlayingWindow } from '../competitions/calendar.js';
import { seasonSchedule } from './world-factory.js';
import { failure } from '../core/result.js';
import { domainError } from '../core/domain-error.js';

export interface DataProvider {
  load(): Promise<Result<WorldDataset>>;
  loadForLeague?(leagueId: string): Promise<Result<WorldDataset>>;
}
export function importDataset(state: WorldState, input: unknown): Result<WorldState> {
  return flatMapResult(parseBoundary(worldDatasetSchema, input), (dataset) => {
    const club =
      dataset.clubs.byId[state.participants[0]?.clubId ?? ''] ??
      Object.values(dataset.clubs.byId).find((item) => item.country === 'BR');
    if (!club || dataset.fixtures?.some((fixture) => !isPlayingWindow(fixture.scheduledAt)))
      return failure(
        domainError(
          'VALIDATION_ERROR',
          'Dataset sem clube brasileiro ou fora da janela de partidas',
        ),
      );
    const correctedClubs = correctSerieC2026(dataset.clubs);
    const schedule = seasonSchedule(Object.values(correctedClubs.byId), state.createdAt);
    const supplied = dataset.fixtures?.map((game) => {
      const count =
        Math.max(
          ...dataset
            .fixtures!.filter((row) => row.competitionId === game.competitionId)
            .map((row) => row.round),
        ) + 1;
      return {
        ...game,
        scheduledAt: competitionDates(game.competitionId, state.season, count)[game.round]!,
      };
    });
    const fixtures = supplied
      ? [
          ...supplied,
          ...schedule.fixtures.filter(
            (fixture) =>
              fixture.group &&
              !dataset.fixtures?.some(
                (existing) => existing.competitionId === fixture.competitionId,
              ),
          ),
        ]
      : schedule.fixtures;
    const cups = dataset.fixtures ? [] : schedule.cups;
    return mapResult(
      parseBoundary(worldStateSchema, {
        ...state,
        dataSource: dataset.source,
        dataLicense: dataset.license,
        clubs: correctedClubs,
        players: dataset.players,
        stadiums: dataset.stadiums,
        centers: dataset.centers,
        fixtures,
        cups,
        competitionNotes: schedule.competitionNotes,
        competitionRulesVersion: schedule.competitionRulesVersion,
        participants: state.participants.map((member) => ({ ...member, clubId: club.id })),
        nextScheduledAt: state.seasonClock
          ? state.nextScheduledAt
          : Math.min(
              ...fixtures.map((fixture) => fixture.scheduledAt),
              ...cups.map((node) => node.scheduledAt),
            ),
      }),
      initializeStartingChemistry,
    );
  });
}
