import type {
  ClubSnapshot,
  GameSnapshot,
  StadiumSnapshot,
  TrainingCenterSnapshot,
} from '@football/shared';
export type ViewProps = {
  snapshot: GameSnapshot;
  club: ClubSnapshot;
  stadium: StadiumSnapshot;
  center: TrainingCenterSnapshot;
};
