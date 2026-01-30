import { Player } from '@devilsdice/shared';

interface RollResult {
  playerId: string;
  roll: number;
}

/**
 * Calculates the initial turn order based on dice roll results.
 * Players are sorted by roll ascending (lowest roll goes first).
 */
export function calculateInitialTurnOrder(rollResults: RollResult[]): string[] {
  return [...rollResults]
    .sort((a, b) => a.roll - b.roll)
    .map((r) => r.playerId);
}

/**
 * Calculates turn order based on cumulative scores.
 * Players with the highest cumulative score go first.
 * For ties, the original order (from initial roll) is used as tiebreaker.
 */
export function calculateTurnOrder(
  players: Player[],
  originalOrder: string[],
): string[] {
  // Create a map of player ID to their original order index
  const originalOrderMap = new Map<string, number>();
  originalOrder.forEach((playerId, index) => {
    originalOrderMap.set(playerId, index);
  });

  // Sort players by cumulative score descending, then by original order for ties
  return [...players]
    .sort((a, b) => {
      // Higher score goes first (descending)
      if (b.cumulativeScore !== a.cumulativeScore) {
        return b.cumulativeScore - a.cumulativeScore;
      }

      // For ties, use original order (earlier in original order goes first)
      const aOriginalIndex = originalOrderMap.get(a.id) ?? Infinity;
      const bOriginalIndex = originalOrderMap.get(b.id) ?? Infinity;
      return aOriginalIndex - bOriginalIndex;
    })
    .map((p) => p.id);
}
