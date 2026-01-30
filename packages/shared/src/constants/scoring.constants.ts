import { PredictionType } from '../types/game.types';

/**
 * Placement points by player count.
 * Designed so max round score is always 12 (6+6) and 0 is always achievable.
 */
export const PLACEMENT_POINTS_BY_PLAYER_COUNT: Record<number, Record<number, number>> = {
  2: { 1: 6, 2: 0 },
  3: { 1: 6, 2: 3, 3: 0 },
  4: { 1: 6, 2: 3, 3: 1, 4: 0 },
  5: { 1: 6, 2: 4, 3: 2, 4: 1, 5: 0 },
  6: { 1: 6, 2: 4, 3: 3, 4: 2, 5: 1, 6: 0 },
};

/**
 * Gets the placement points for a given placement and player count.
 */
export function getPlacementPoints(placement: number, playerCount: number): number {
  const pointsTable = PLACEMENT_POINTS_BY_PLAYER_COUNT[playerCount];
  if (!pointsTable) {
    // Fallback to 4-player rules if player count not defined
    return PLACEMENT_POINTS_BY_PLAYER_COUNT[4][placement] ?? 0;
  }
  return pointsTable[placement] ?? 0;
}

/**
 * Prediction ranges by player count.
 * For 2 players: Only ZERO, MORE (as middle), MAX are valid (3 options)
 * For 3+ players: All 4 predictions are valid
 *
 * Design: ZERO gives +40 fixed bonus, others double points.
 * MAX is 10-12 to balance risk/reward vs ZERO's +40.
 */
export const PREDICTION_RANGES_BY_PLAYER_COUNT: Record<number, Record<PredictionType, [number, number]>> = {
  // 2 players: achievable scores are 0, 6, 12
  // ZERO = 0 (lose both), MORE = 6 (split), MAX = 12 (win both)
  // MIN is skipped (maps to invalid range so it won't match)
  2: {
    [PredictionType.ZERO]: [0, 0],
    [PredictionType.MIN]: [-1, -1], // Invalid range - not used for 2 players
    [PredictionType.MORE]: [6, 6],
    [PredictionType.MAX]: [12, 12],
  },
  // 3 players: achievable scores are 0, 3, 6, 9, 12
  // Note: 10-12 range only matches 12 for 3 players
  3: {
    [PredictionType.ZERO]: [0, 0],
    [PredictionType.MIN]: [3, 3],
    [PredictionType.MORE]: [6, 9],
    [PredictionType.MAX]: [10, 12],
  },
  // 4 players: achievable scores are 0, 1, 2, 3, 4, 6, 7, 9, 12
  // Note: 10-12 range only matches 12 for 4 players (10, 11 not achievable)
  4: {
    [PredictionType.ZERO]: [0, 0],
    [PredictionType.MIN]: [1, 4],
    [PredictionType.MORE]: [6, 9],
    [PredictionType.MAX]: [10, 12],
  },
  // 5 players: achievable scores are 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12
  // 10-12 matches 10 and 12
  5: {
    [PredictionType.ZERO]: [0, 0],
    [PredictionType.MIN]: [1, 4],
    [PredictionType.MORE]: [5, 8],
    [PredictionType.MAX]: [10, 12],
  },
  // 6 players: achievable scores are 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12
  // 10-12 matches 10 and 12 (11 not achievable)
  6: {
    [PredictionType.ZERO]: [0, 0],
    [PredictionType.MIN]: [1, 4],
    [PredictionType.MORE]: [5, 9],
    [PredictionType.MAX]: [10, 12],
  },
};

/**
 * Gets the prediction range for a given prediction type and player count.
 */
export function getPredictionRange(prediction: PredictionType, playerCount: number): [number, number] {
  const ranges = PREDICTION_RANGES_BY_PLAYER_COUNT[playerCount];
  if (!ranges) {
    // Fallback to 4-player rules
    return PREDICTION_RANGES_BY_PLAYER_COUNT[4][prediction];
  }
  return ranges[prediction];
}

/**
 * Gets the available prediction types for a given player count.
 * 2 players: ZERO, MORE, MAX (3 options - MORE acts as "split")
 * 3+ players: All 4 options
 */
export function getAvailablePredictions(playerCount: number): PredictionType[] {
  if (playerCount === 2) {
    return [PredictionType.ZERO, PredictionType.MORE, PredictionType.MAX];
  }
  return [PredictionType.ZERO, PredictionType.MIN, PredictionType.MORE, PredictionType.MAX];
}

/**
 * Gets human-readable prediction info for UI display.
 */
export function getPredictionInfo(prediction: PredictionType, playerCount: number): {
  title: string;
  condition: string;
  description: string;
} {
  const [min, max] = getPredictionRange(prediction, playerCount);

  // Special labels for 2-player mode
  if (playerCount === 2) {
    switch (prediction) {
      case PredictionType.ZERO:
        return {
          title: 'Lose',
          condition: 'Score 0 points',
          description: 'Lose both sets to your opponent.',
        };
      case PredictionType.MORE:
        return {
          title: 'Split',
          condition: 'Score 6 points',
          description: 'Win one set, lose one set.',
        };
      case PredictionType.MAX:
        return {
          title: 'Sweep',
          condition: 'Score 12 points',
          description: 'Win both sets against your opponent.',
        };
      default:
        return { title: '', condition: '', description: '' };
    }
  }

  // Standard labels for 3+ players
  switch (prediction) {
    case PredictionType.ZERO:
      return {
        title: 'Zero',
        condition: 'Score exactly 0',
        description: 'High risk, high reward! Place last in both sets.',
      };
    case PredictionType.MIN:
      return {
        title: 'Min',
        condition: min === max ? `Score ${min} points` : `Score ${min}-${max} points`,
        description: 'Conservative play. Aim for lower placements.',
      };
    case PredictionType.MORE:
      return {
        title: 'More',
        condition: min === max ? `Score ${min} points` : `Score ${min}-${max} points`,
        description: 'Balanced approach. Mix of good placements.',
      };
    case PredictionType.MAX:
      return {
        title: 'Max',
        condition: min === max ? `Score ${min} points` : `Score ${min}-${max} points`,
        description: 'Go for gold! Aim for top placements.',
      };
  }
}

export const SCORING = {
  PREDICTION_ZERO_BONUS: 40,
  PREDICTION_MULTIPLIER: 2,
  MAX_ROUND_POINTS: 12, // 6 + 6 from both sets (consistent across all player counts)

  // Legacy - kept for backwards compatibility, use functions above instead
  PLACEMENT_POINTS: {
    1: 6,
    2: 3,
    3: 1,
  } as Record<number, number>,

  PREDICTION_RANGES: {
    [PredictionType.ZERO]: [0, 0],
    [PredictionType.MIN]: [1, 4],
    [PredictionType.MORE]: [6, 9],
    [PredictionType.MAX]: [10, 12],
  } as Record<PredictionType, [number, number]>,
} as const;

export type ScoringConstants = typeof SCORING;
