import { Die, DieColor, HandRank } from '@devilsdice/shared';
import { evaluateHand, compareHands } from './hand-evaluator';

// Helper function to create dice for testing
function createDice(values: number[]): Die[] {
  return values.map((value, index) => ({
    id: `die-${index}`,
    color: DieColor.WHITE,
    value,
    isSpent: false,
    isRevealed: true,
  }));
}

describe('evaluateHand', () => {
  describe('Triple detection', () => {
    it('should detect triple 5s', () => {
      const dice = createDice([5, 5, 5]);
      const result = evaluateHand(dice);

      expect(result.rank).toBe(HandRank.TRIPLE);
      expect(result.primaryValue).toBe(5);
      expect(result.secondaryValue).toBe(0);
      expect(result.tertiaryValue).toBe(0);
      expect(result.description).toBe('Triple 5s');
    });

    it('should detect triple 1s', () => {
      const dice = createDice([1, 1, 1]);
      const result = evaluateHand(dice);

      expect(result.rank).toBe(HandRank.TRIPLE);
      expect(result.primaryValue).toBe(1);
      expect(result.description).toBe('Triple 1s');
    });

    it('should detect triple 6s', () => {
      const dice = createDice([6, 6, 6]);
      const result = evaluateHand(dice);

      expect(result.rank).toBe(HandRank.TRIPLE);
      expect(result.primaryValue).toBe(6);
      expect(result.description).toBe('Triple 6s');
    });
  });

  describe('Straight detection', () => {
    it('should detect straight 1-2-3', () => {
      const dice = createDice([3, 1, 2]); // Unsorted
      const result = evaluateHand(dice);

      expect(result.rank).toBe(HandRank.STRAIGHT);
      expect(result.primaryValue).toBe(3);
      expect(result.description).toBe('Straight 1-2-3');
    });

    it('should detect straight 2-3-4', () => {
      const dice = createDice([2, 4, 3]);
      const result = evaluateHand(dice);

      expect(result.rank).toBe(HandRank.STRAIGHT);
      expect(result.primaryValue).toBe(4);
      expect(result.description).toBe('Straight 2-3-4');
    });

    it('should detect straight 3-4-5', () => {
      const dice = createDice([5, 3, 4]);
      const result = evaluateHand(dice);

      expect(result.rank).toBe(HandRank.STRAIGHT);
      expect(result.primaryValue).toBe(5);
      expect(result.description).toBe('Straight 3-4-5');
    });

    it('should detect straight 4-5-6', () => {
      const dice = createDice([4, 6, 5]);
      const result = evaluateHand(dice);

      expect(result.rank).toBe(HandRank.STRAIGHT);
      expect(result.primaryValue).toBe(6);
      expect(result.description).toBe('Straight 4-5-6');
    });

    it('should NOT detect wrap-around straight (5-6-1)', () => {
      const dice = createDice([5, 6, 1]);
      const result = evaluateHand(dice);

      expect(result.rank).toBe(HandRank.SINGLE);
    });

    it('should NOT detect non-consecutive values as straight (1-3-5)', () => {
      const dice = createDice([1, 3, 5]);
      const result = evaluateHand(dice);

      expect(result.rank).toBe(HandRank.SINGLE);
      expect(result.primaryValue).toBe(5);
      expect(result.secondaryValue).toBe(3);
      expect(result.tertiaryValue).toBe(1);
    });
  });

  describe('Double detection', () => {
    it('should detect pair of 4s with 2 kicker', () => {
      const dice = createDice([4, 4, 2]);
      const result = evaluateHand(dice);

      expect(result.rank).toBe(HandRank.DOUBLE);
      expect(result.primaryValue).toBe(4);
      expect(result.secondaryValue).toBe(2);
      expect(result.tertiaryValue).toBe(0);
      expect(result.description).toBe('Pair of 4s, 2 kicker');
    });

    it('should detect pair of 2s with 6 kicker', () => {
      const dice = createDice([2, 6, 2]);
      const result = evaluateHand(dice);

      expect(result.rank).toBe(HandRank.DOUBLE);
      expect(result.primaryValue).toBe(2);
      expect(result.secondaryValue).toBe(6);
      expect(result.description).toBe('Pair of 2s, 6 kicker');
    });

    it('should detect pair of 6s with 1 kicker', () => {
      const dice = createDice([6, 1, 6]);
      const result = evaluateHand(dice);

      expect(result.rank).toBe(HandRank.DOUBLE);
      expect(result.primaryValue).toBe(6);
      expect(result.secondaryValue).toBe(1);
      expect(result.description).toBe('Pair of 6s, 1 kicker');
    });
  });

  describe('Single detection', () => {
    it('should detect single with values sorted descending', () => {
      const dice = createDice([6, 3, 1]);
      const result = evaluateHand(dice);

      expect(result.rank).toBe(HandRank.SINGLE);
      expect(result.primaryValue).toBe(6);
      expect(result.secondaryValue).toBe(3);
      expect(result.tertiaryValue).toBe(1);
      expect(result.description).toBe('High 6, 3, 1');
    });

    it('should handle unsorted input for single', () => {
      const dice = createDice([2, 6, 4]);
      const result = evaluateHand(dice);

      expect(result.rank).toBe(HandRank.SINGLE);
      expect(result.primaryValue).toBe(6);
      expect(result.secondaryValue).toBe(4);
      expect(result.tertiaryValue).toBe(2);
      expect(result.description).toBe('High 6, 4, 2');
    });
  });

  describe('Error handling', () => {
    it('should throw error for hand with less than 3 dice', () => {
      const dice = createDice([5, 5]);
      expect(() => evaluateHand(dice)).toThrow(
        'Hand must contain exactly 3 dice',
      );
    });

    it('should throw error for hand with more than 3 dice', () => {
      const dice = createDice([5, 5, 5, 5]);
      expect(() => evaluateHand(dice)).toThrow(
        'Hand must contain exactly 3 dice',
      );
    });

    it('should throw error for empty hand', () => {
      expect(() => evaluateHand([])).toThrow(
        'Hand must contain exactly 3 dice',
      );
    });
  });
});

describe('compareHands', () => {
  describe('Rank comparison', () => {
    it('should rank Triple higher than Straight', () => {
      const triple = evaluateHand(createDice([2, 2, 2]));
      const straight = evaluateHand(createDice([4, 5, 6]));

      expect(compareHands(triple, straight)).toBeGreaterThan(0);
      expect(compareHands(straight, triple)).toBeLessThan(0);
    });

    it('should rank Straight higher than Double', () => {
      const straight = evaluateHand(createDice([1, 2, 3]));
      const double = evaluateHand(createDice([6, 6, 5]));

      expect(compareHands(straight, double)).toBeGreaterThan(0);
      expect(compareHands(double, straight)).toBeLessThan(0);
    });

    it('should rank Double higher than Single', () => {
      const double = evaluateHand(createDice([1, 1, 2]));
      const single = evaluateHand(createDice([6, 4, 2])); // Non-consecutive values

      expect(compareHands(double, single)).toBeGreaterThan(0);
      expect(compareHands(single, double)).toBeLessThan(0);
    });

    it('Triple 2s should beat Straight 4-5-6', () => {
      const triple2s = evaluateHand(createDice([2, 2, 2]));
      const straight456 = evaluateHand(createDice([4, 5, 6]));

      expect(compareHands(triple2s, straight456)).toBeGreaterThan(0);
    });
  });

  describe('Primary value comparison', () => {
    it('should compare triples by value', () => {
      const triple6 = evaluateHand(createDice([6, 6, 6]));
      const triple5 = evaluateHand(createDice([5, 5, 5]));

      expect(compareHands(triple6, triple5)).toBeGreaterThan(0);
      expect(compareHands(triple5, triple6)).toBeLessThan(0);
    });

    it('Straight 4-5-6 should beat Straight 1-2-3', () => {
      const straight456 = evaluateHand(createDice([4, 5, 6]));
      const straight123 = evaluateHand(createDice([1, 2, 3]));

      expect(compareHands(straight456, straight123)).toBeGreaterThan(0);
    });

    it('should compare doubles by pair value first', () => {
      const pair6 = evaluateHand(createDice([6, 6, 1]));
      const pair5 = evaluateHand(createDice([5, 5, 6]));

      expect(compareHands(pair6, pair5)).toBeGreaterThan(0);
    });
  });

  describe('Secondary value comparison', () => {
    it('should compare doubles by kicker when pairs equal', () => {
      const pair5Kicker6 = evaluateHand(createDice([5, 5, 6]));
      const pair5Kicker4 = evaluateHand(createDice([5, 5, 4]));

      expect(compareHands(pair5Kicker6, pair5Kicker4)).toBeGreaterThan(0);
    });

    it('should compare singles by second highest when first equal', () => {
      const high654 = evaluateHand(createDice([6, 5, 4]));
      const high632 = evaluateHand(createDice([6, 3, 2]));

      expect(compareHands(high654, high632)).toBeGreaterThan(0);
    });
  });

  describe('Tertiary value comparison', () => {
    it('should compare singles by third value when first two equal', () => {
      const high653 = evaluateHand(createDice([6, 5, 3]));
      const high652 = evaluateHand(createDice([6, 5, 2]));

      expect(compareHands(high653, high652)).toBeGreaterThan(0);
    });
  });

  describe('Equal hands', () => {
    it('should return 0 for identical triples', () => {
      const triple5a = evaluateHand(createDice([5, 5, 5]));
      const triple5b = evaluateHand(createDice([5, 5, 5]));

      expect(compareHands(triple5a, triple5b)).toBe(0);
    });

    it('should return 0 for identical straights', () => {
      const straight123a = evaluateHand(createDice([1, 2, 3]));
      const straight123b = evaluateHand(createDice([3, 2, 1])); // Different order

      expect(compareHands(straight123a, straight123b)).toBe(0);
    });

    it('should return 0 for identical doubles', () => {
      const pair4a = evaluateHand(createDice([4, 4, 2]));
      const pair4b = evaluateHand(createDice([4, 2, 4])); // Different order

      expect(compareHands(pair4a, pair4b)).toBe(0);
    });

    it('should return 0 for identical singles', () => {
      const single1 = evaluateHand(createDice([6, 4, 2]));
      const single2 = evaluateHand(createDice([2, 6, 4])); // Different order

      expect(compareHands(single1, single2)).toBe(0);
    });
  });
});
