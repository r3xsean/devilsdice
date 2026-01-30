import { Die, EvaluatedHand, HandRank } from '@devilsdice/shared';

/**
 * Evaluates a hand of exactly 3 dice and returns the evaluated hand result.
 * Hand rankings from highest to lowest: TRIPLE > STRAIGHT > DOUBLE > SINGLE
 */
export function evaluateHand(dice: Die[]): EvaluatedHand {
  if (dice.length !== 3) {
    throw new Error('Hand must contain exactly 3 dice');
  }

  const values = dice.map((d) => d.value).sort((a, b) => a - b);
  const [low, mid, high] = values;

  // Check for Triple: all 3 same value
  if (low === mid && mid === high) {
    return {
      rank: HandRank.TRIPLE,
      primaryValue: high,
      secondaryValue: 0,
      tertiaryValue: 0,
      description: `Triple ${high}s`,
    };
  }

  // Check for Straight: consecutive values (1-2-3, 2-3-4, 3-4-5, 4-5-6 ONLY, NO wrap)
  if (mid === low + 1 && high === mid + 1) {
    return {
      rank: HandRank.STRAIGHT,
      primaryValue: high,
      secondaryValue: 0,
      tertiaryValue: 0,
      description: `Straight ${low}-${mid}-${high}`,
    };
  }

  // Check for Double: 2 same, 1 different
  if (low === mid) {
    // Pair is the lower two values, kicker is high
    return {
      rank: HandRank.DOUBLE,
      primaryValue: low,
      secondaryValue: high,
      tertiaryValue: 0,
      description: `Pair of ${low}s, ${high} kicker`,
    };
  }

  if (mid === high) {
    // Pair is the higher two values, kicker is low
    return {
      rank: HandRank.DOUBLE,
      primaryValue: high,
      secondaryValue: low,
      tertiaryValue: 0,
      description: `Pair of ${high}s, ${low} kicker`,
    };
  }

  // Default: Single (high card)
  return {
    rank: HandRank.SINGLE,
    primaryValue: high,
    secondaryValue: mid,
    tertiaryValue: low,
    description: `High ${high}, ${mid}, ${low}`,
  };
}

/**
 * Compares two evaluated hands.
 * Returns positive if a > b, negative if a < b, 0 if equal.
 * Comparison order: rank > primaryValue > secondaryValue > tertiaryValue
 */
export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  // Compare by rank first (TRIPLE > STRAIGHT > DOUBLE > SINGLE)
  if (a.rank !== b.rank) {
    return a.rank - b.rank;
  }

  // Then by primaryValue
  if (a.primaryValue !== b.primaryValue) {
    return a.primaryValue - b.primaryValue;
  }

  // Then by secondaryValue
  if (a.secondaryValue !== b.secondaryValue) {
    return a.secondaryValue - b.secondaryValue;
  }

  // Finally by tertiaryValue
  return a.tertiaryValue - b.tertiaryValue;
}
