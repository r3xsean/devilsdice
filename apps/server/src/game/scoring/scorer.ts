import {
  EvaluatedHand,
  SetResult,
  PredictionType,
  SCORING,
  Die,
  getPlacementPoints,
  getPredictionRange,
} from '@devilsdice/shared';
import { compareHands } from './hand-evaluator';

interface PlayerSelection {
  playerId: string;
  hand: EvaluatedHand;
  diceUsed?: string[];
  diceValues?: Die[];
}

/**
 * Calculates placements and points for a set based on player hand selections.
 * Handles ties by sharing the same placement and splitting points evenly.
 */
export function calculateSetPlacements(
  selections: PlayerSelection[],
  playerCount?: number,
): SetResult[] {
  if (selections.length === 0) {
    return [];
  }

  // Use provided player count or infer from selections
  const actualPlayerCount = playerCount ?? selections.length;

  // Sort players by hand ranking (best first - descending)
  const sorted = [...selections].sort((a, b) => compareHands(b.hand, a.hand));

  const results: SetResult[] = [];
  let currentPlacement = 1;
  let i = 0;

  while (i < sorted.length) {
    // Find all players tied at this position
    const tiedPlayers: PlayerSelection[] = [sorted[i]];
    let j = i + 1;

    while (
      j < sorted.length &&
      compareHands(sorted[i].hand, sorted[j].hand) === 0
    ) {
      tiedPlayers.push(sorted[j]);
      j++;
    }

    // Calculate points for tied players
    // Sum up all the points for the placements they occupy
    let totalPoints = 0;
    for (
      let p = currentPlacement;
      p < currentPlacement + tiedPlayers.length;
      p++
    ) {
      totalPoints += getPlacementPoints(p, actualPlayerCount);
    }

    const pointsPerPlayer = totalPoints / tiedPlayers.length;

    // Create results for all tied players
    for (const player of tiedPlayers) {
      results.push({
        playerId: player.playerId,
        hand: player.hand,
        diceUsed: player.diceUsed || [],
        diceValues: player.diceValues || [],
        placement: currentPlacement,
        pointsEarned: pointsPerPlayer,
      });
    }

    // Move to next placement (skip over tied positions)
    currentPlacement += tiedPlayers.length;
    i = j;
  }

  return results;
}

/**
 * Calculates the prediction bonus based on the prediction type, round total, and player count.
 * Returns 0 if prediction is wrong.
 */
export function calculatePredictionBonus(
  prediction: PredictionType,
  roundTotal: number,
  playerCount: number,
): number {
  const [min, max] = getPredictionRange(prediction, playerCount);

  // Check if the round total falls within the prediction range
  if (roundTotal < min || roundTotal > max) {
    return 0; // Wrong prediction
  }

  // ZERO prediction has a flat bonus
  if (prediction === PredictionType.ZERO) {
    return SCORING.PREDICTION_ZERO_BONUS;
  }

  // MIN, MORE, MAX predictions double the round points (return the roundTotal as bonus)
  return roundTotal;
}
