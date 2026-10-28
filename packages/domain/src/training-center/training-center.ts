import { trainingCenterSchema, type TrainingCenterSnapshot } from '@football/shared';
import { parseBoundary } from '../core/validation.js';
import type { Result } from '../core/result.js';

export type TrainingCenter = TrainingCenterSnapshot;

export function createTrainingCenter(input: unknown): Result<TrainingCenter> {
  return parseBoundary(trainingCenterSchema, input);
}
