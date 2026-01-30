import {
  Die,
  DieColor,
  EvaluatedHand,
  HandRank,
  PredictionType,
} from '@devilsdice/shared';
import { calculateSetPlacements, calculatePredictionBonus } from './scorer';
import { evaluateHand } from './hand-evaluator';

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

describe('calculateSetPlacements', () => {
  describe('4 players - Distinct hands (no ties)', () => {
    it('should assign 6, 3, 1, 0 points for 4 players with distinct hands', () => {
      const selections = [
        { playerId: 'p1', hand: evaluateHand(createDice([2, 2, 2])) }, // Triple 2s (best)
        { playerId: 'p2', hand: evaluateHand(createDice([4, 5, 6])) }, // Straight 4-5-6
        { playerId: 'p3', hand: evaluateHand(createDice([5, 5, 3])) }, // Pair of 5s
        { playerId: 'p4', hand: evaluateHand(createDice([6, 4, 2])) }, // High 6, 4, 2 (worst)
      ];

      const results = calculateSetPlacements(selections, 4);

      // Find each player's result
      const p1Result = results.find((r) => r.playerId === 'p1');
      const p2Result = results.find((r) => r.playerId === 'p2');
      const p3Result = results.find((r) => r.playerId === 'p3');
      const p4Result = results.find((r) => r.playerId === 'p4');

      expect(p1Result?.placement).toBe(1);
      expect(p1Result?.pointsEarned).toBe(6);

      expect(p2Result?.placement).toBe(2);
      expect(p2Result?.pointsEarned).toBe(3);

      expect(p3Result?.placement).toBe(3);
      expect(p3Result?.pointsEarned).toBe(1);

      expect(p4Result?.placement).toBe(4);
      expect(p4Result?.pointsEarned).toBe(0);
    });
  });

  describe('2 players - scaled points (6, 0)', () => {
    it('should assign 6 to winner and 0 to loser with 2 players', () => {
      const selections = [
        { playerId: 'p1', hand: evaluateHand(createDice([3, 3, 3])) },
        { playerId: 'p2', hand: evaluateHand(createDice([1, 2, 3])) },
      ];

      const results = calculateSetPlacements(selections, 2);

      const p1Result = results.find((r) => r.playerId === 'p1');
      const p2Result = results.find((r) => r.playerId === 'p2');

      expect(p1Result?.placement).toBe(1);
      expect(p1Result?.pointsEarned).toBe(6);

      expect(p2Result?.placement).toBe(2);
      expect(p2Result?.pointsEarned).toBe(0);
    });

    it('should split points for 2 players tied: (6+0)/2 = 3 each', () => {
      const selections = [
        { playerId: 'p1', hand: evaluateHand(createDice([5, 5, 5])) },
        { playerId: 'p2', hand: evaluateHand(createDice([5, 5, 5])) },
      ];

      const results = calculateSetPlacements(selections, 2);

      expect(results[0].placement).toBe(1);
      expect(results[0].pointsEarned).toBe(3);
      expect(results[1].placement).toBe(1);
      expect(results[1].pointsEarned).toBe(3);
    });
  });

  describe('3 players - scaled points (6, 3, 0)', () => {
    it('should assign 6, 3, 0 for 3 players', () => {
      const selections = [
        { playerId: 'p1', hand: evaluateHand(createDice([6, 6, 6])) },
        { playerId: 'p2', hand: evaluateHand(createDice([4, 5, 6])) },
        { playerId: 'p3', hand: evaluateHand(createDice([2, 2, 1])) },
      ];

      const results = calculateSetPlacements(selections, 3);

      expect(results.find((r) => r.playerId === 'p1')?.pointsEarned).toBe(6);
      expect(results.find((r) => r.playerId === 'p2')?.pointsEarned).toBe(3);
      expect(results.find((r) => r.playerId === 'p3')?.pointsEarned).toBe(0);
    });
  });

  describe('5 players - scaled points (6, 4, 2, 1, 0)', () => {
    it('should assign correct points for 5 players', () => {
      // Hand rankings: Triple > Straight > Double > Single
      const selections = [
        { playerId: 'p1', hand: evaluateHand(createDice([6, 6, 6])) }, // 1st - Triple 6s
        { playerId: 'p2', hand: evaluateHand(createDice([5, 5, 5])) }, // 2nd - Triple 5s
        { playerId: 'p3', hand: evaluateHand(createDice([4, 5, 6])) }, // 3rd - Straight
        { playerId: 'p4', hand: evaluateHand(createDice([2, 2, 1])) }, // 4th - Pair
        { playerId: 'p5', hand: evaluateHand(createDice([1, 2, 4])) }, // 5th - High card
      ];

      const results = calculateSetPlacements(selections, 5);

      expect(results.find((r) => r.playerId === 'p1')?.pointsEarned).toBe(6);
      expect(results.find((r) => r.playerId === 'p2')?.pointsEarned).toBe(4);
      expect(results.find((r) => r.playerId === 'p3')?.pointsEarned).toBe(2);
      expect(results.find((r) => r.playerId === 'p4')?.pointsEarned).toBe(1);
      expect(results.find((r) => r.playerId === 'p5')?.pointsEarned).toBe(0);
    });
  });

  describe('6 players - scaled points (6, 4, 3, 2, 1, 0)', () => {
    it('should assign correct points for 6 players', () => {
      // Hand rankings: Triple > Straight > Double > Single
      const selections = [
        { playerId: 'p1', hand: evaluateHand(createDice([6, 6, 6])) }, // 1st - Triple 6s
        { playerId: 'p2', hand: evaluateHand(createDice([5, 5, 5])) }, // 2nd - Triple 5s
        { playerId: 'p3', hand: evaluateHand(createDice([4, 4, 4])) }, // 3rd - Triple 4s
        { playerId: 'p4', hand: evaluateHand(createDice([4, 5, 6])) }, // 4th - Straight
        { playerId: 'p5', hand: evaluateHand(createDice([2, 2, 1])) }, // 5th - Pair
        { playerId: 'p6', hand: evaluateHand(createDice([1, 2, 4])) }, // 6th - High card
      ];

      const results = calculateSetPlacements(selections, 6);

      expect(results.find((r) => r.playerId === 'p1')?.pointsEarned).toBe(6);
      expect(results.find((r) => r.playerId === 'p2')?.pointsEarned).toBe(4);
      expect(results.find((r) => r.playerId === 'p3')?.pointsEarned).toBe(3);
      expect(results.find((r) => r.playerId === 'p4')?.pointsEarned).toBe(2);
      expect(results.find((r) => r.playerId === 'p5')?.pointsEarned).toBe(1);
      expect(results.find((r) => r.playerId === 'p6')?.pointsEarned).toBe(0);
    });
  });

  describe('Ties for 1st place', () => {
    it('should split points for 2 players tied for 1st in 4-player game: (6+3)/2 = 4.5 each', () => {
      const selections = [
        { playerId: 'p1', hand: evaluateHand(createDice([5, 5, 5])) },
        { playerId: 'p2', hand: evaluateHand(createDice([5, 5, 5])) }, // Tied with p1
        { playerId: 'p3', hand: evaluateHand(createDice([4, 5, 6])) }, // 3rd place
        { playerId: 'p4', hand: evaluateHand(createDice([1, 2, 3])) }, // 4th place
      ];

      const results = calculateSetPlacements(selections, 4);

      const p1Result = results.find((r) => r.playerId === 'p1');
      const p2Result = results.find((r) => r.playerId === 'p2');
      const p3Result = results.find((r) => r.playerId === 'p3');

      expect(p1Result?.placement).toBe(1);
      expect(p1Result?.pointsEarned).toBe(4.5);

      expect(p2Result?.placement).toBe(1);
      expect(p2Result?.pointsEarned).toBe(4.5);

      expect(p3Result?.placement).toBe(3);
      expect(p3Result?.pointsEarned).toBe(1);
    });

    it('should handle 3 players tied for 1st in 3-player game: (6+3+0)/3 = 3 each', () => {
      const selections = [
        { playerId: 'p1', hand: evaluateHand(createDice([4, 4, 4])) },
        { playerId: 'p2', hand: evaluateHand(createDice([4, 4, 4])) },
        { playerId: 'p3', hand: evaluateHand(createDice([4, 4, 4])) },
      ];

      const results = calculateSetPlacements(selections, 3);

      // (6 + 3 + 0) / 3 = 3
      const expectedPoints = 3;

      expect(results[0].placement).toBe(1);
      expect(results[0].pointsEarned).toBeCloseTo(expectedPoints, 5);
      expect(results[1].pointsEarned).toBeCloseTo(expectedPoints, 5);
      expect(results[2].pointsEarned).toBeCloseTo(expectedPoints, 5);
    });
  });

  describe('Ties for 2nd place', () => {
    it('should split points for 3 players tied for 2nd in 4-player: (3+1+0)/3 = 1.33 each', () => {
      const selections = [
        { playerId: 'p1', hand: evaluateHand(createDice([6, 6, 6])) }, // 1st place
        { playerId: 'p2', hand: evaluateHand(createDice([3, 4, 5])) }, // Tied for 2nd
        { playerId: 'p3', hand: evaluateHand(createDice([3, 4, 5])) }, // Tied for 2nd
        { playerId: 'p4', hand: evaluateHand(createDice([3, 4, 5])) }, // Tied for 2nd
      ];

      const results = calculateSetPlacements(selections, 4);

      const p1Result = results.find((r) => r.playerId === 'p1');
      const p2Result = results.find((r) => r.playerId === 'p2');
      const p3Result = results.find((r) => r.playerId === 'p3');
      const p4Result = results.find((r) => r.playerId === 'p4');

      expect(p1Result?.placement).toBe(1);
      expect(p1Result?.pointsEarned).toBe(6);

      // (3 + 1 + 0) / 3 = 4/3 = 1.333...
      const expectedPoints = 4 / 3;
      expect(p2Result?.placement).toBe(2);
      expect(p2Result?.pointsEarned).toBeCloseTo(expectedPoints, 5);
      expect(p3Result?.placement).toBe(2);
      expect(p3Result?.pointsEarned).toBeCloseTo(expectedPoints, 5);
      expect(p4Result?.placement).toBe(2);
      expect(p4Result?.pointsEarned).toBeCloseTo(expectedPoints, 5);
    });

    it('should split points for 2 players tied for 2nd in 4-player: (3+1)/2 = 2 each', () => {
      const selections = [
        { playerId: 'p1', hand: evaluateHand(createDice([6, 6, 6])) }, // 1st
        { playerId: 'p2', hand: evaluateHand(createDice([4, 5, 6])) }, // Tied 2nd
        { playerId: 'p3', hand: evaluateHand(createDice([4, 5, 6])) }, // Tied 2nd
        { playerId: 'p4', hand: evaluateHand(createDice([6, 3, 1])) }, // 4th
      ];

      const results = calculateSetPlacements(selections, 4);

      expect(results.find((r) => r.playerId === 'p1')?.pointsEarned).toBe(6);
      expect(results.find((r) => r.playerId === 'p2')?.pointsEarned).toBe(2);
      expect(results.find((r) => r.playerId === 'p3')?.pointsEarned).toBe(2);
      expect(results.find((r) => r.playerId === 'p4')?.pointsEarned).toBe(0);
    });
  });

  describe('Ties for 3rd place', () => {
    it('should split points for 2 players tied for 3rd in 4-player: (1+0)/2 = 0.5 each', () => {
      const selections = [
        { playerId: 'p1', hand: evaluateHand(createDice([6, 6, 6])) }, // 1st
        { playerId: 'p2', hand: evaluateHand(createDice([4, 5, 6])) }, // 2nd
        { playerId: 'p3', hand: evaluateHand(createDice([5, 5, 4])) }, // Tied 3rd
        { playerId: 'p4', hand: evaluateHand(createDice([5, 5, 4])) }, // Tied 3rd
      ];

      const results = calculateSetPlacements(selections, 4);

      expect(results.find((r) => r.playerId === 'p1')?.pointsEarned).toBe(6);
      expect(results.find((r) => r.playerId === 'p2')?.pointsEarned).toBe(3);
      expect(results.find((r) => r.playerId === 'p3')?.pointsEarned).toBe(0.5);
      expect(results.find((r) => r.playerId === 'p4')?.pointsEarned).toBe(0.5);
    });
  });

  describe('Edge cases', () => {
    it('should return empty array for no selections', () => {
      const results = calculateSetPlacements([]);
      expect(results).toEqual([]);
    });

    it('should handle single player', () => {
      const selections = [
        { playerId: 'p1', hand: evaluateHand(createDice([1, 2, 3])) },
      ];

      const results = calculateSetPlacements(selections);

      expect(results.length).toBe(1);
      expect(results[0].placement).toBe(1);
      expect(results[0].pointsEarned).toBe(6);
    });

    it('should include hand in results', () => {
      const hand = evaluateHand(createDice([5, 5, 5]));
      const selections = [{ playerId: 'p1', hand }];

      const results = calculateSetPlacements(selections);

      expect(results[0].hand).toEqual(hand);
    });

    it('should preserve diceUsed when provided', () => {
      const selections = [
        {
          playerId: 'p1',
          hand: evaluateHand(createDice([5, 5, 5])),
          diceUsed: ['die-1', 'die-2', 'die-3'],
        },
      ];

      const results = calculateSetPlacements(selections);

      expect(results[0].diceUsed).toEqual(['die-1', 'die-2', 'die-3']);
    });
  });
});

describe('calculatePredictionBonus', () => {
  describe('4 players - ZERO prediction', () => {
    it('should return 40 bonus when roundTotal is 0', () => {
      expect(calculatePredictionBonus(PredictionType.ZERO, 0, 4)).toBe(40);
    });

    it('should return 0 when roundTotal is not 0', () => {
      expect(calculatePredictionBonus(PredictionType.ZERO, 1, 4)).toBe(0);
      expect(calculatePredictionBonus(PredictionType.ZERO, 6, 4)).toBe(0);
      expect(calculatePredictionBonus(PredictionType.ZERO, 12, 4)).toBe(0);
    });
  });

  describe('4 players - MIN prediction (1-4)', () => {
    it('should return roundTotal as bonus when in range 1-4', () => {
      expect(calculatePredictionBonus(PredictionType.MIN, 1, 4)).toBe(1);
      expect(calculatePredictionBonus(PredictionType.MIN, 3, 4)).toBe(3);
      expect(calculatePredictionBonus(PredictionType.MIN, 4, 4)).toBe(4);
    });

    it('should return 0 when roundTotal is outside range', () => {
      expect(calculatePredictionBonus(PredictionType.MIN, 0, 4)).toBe(0);
      expect(calculatePredictionBonus(PredictionType.MIN, 5, 4)).toBe(0);
      expect(calculatePredictionBonus(PredictionType.MIN, 12, 4)).toBe(0);
    });
  });

  describe('4 players - MORE prediction (6-9)', () => {
    it('should return roundTotal as bonus when in range 6-9', () => {
      expect(calculatePredictionBonus(PredictionType.MORE, 6, 4)).toBe(6);
      expect(calculatePredictionBonus(PredictionType.MORE, 7, 4)).toBe(7);
      expect(calculatePredictionBonus(PredictionType.MORE, 9, 4)).toBe(9);
    });

    it('should return 0 when roundTotal is outside range', () => {
      expect(calculatePredictionBonus(PredictionType.MORE, 5, 4)).toBe(0);
      expect(calculatePredictionBonus(PredictionType.MORE, 10, 4)).toBe(0);
      expect(calculatePredictionBonus(PredictionType.MORE, 0, 4)).toBe(0);
    });
  });

  describe('4 players - MAX prediction (10-12)', () => {
    it('should return roundTotal as bonus when in range 10-12', () => {
      // Note: For 4 players, only 12 is achievable in this range (10, 11 not achievable)
      expect(calculatePredictionBonus(PredictionType.MAX, 10, 4)).toBe(10);
      expect(calculatePredictionBonus(PredictionType.MAX, 12, 4)).toBe(12);
    });

    it('should return 0 when roundTotal is outside range', () => {
      expect(calculatePredictionBonus(PredictionType.MAX, 9, 4)).toBe(0);
      expect(calculatePredictionBonus(PredictionType.MAX, 6, 4)).toBe(0);
      expect(calculatePredictionBonus(PredictionType.MAX, 0, 4)).toBe(0);
    });
  });

  describe('2 players - special predictions', () => {
    it('ZERO should match score 0', () => {
      expect(calculatePredictionBonus(PredictionType.ZERO, 0, 2)).toBe(40);
      expect(calculatePredictionBonus(PredictionType.ZERO, 6, 2)).toBe(0);
    });

    it('MORE should match score 6 (split)', () => {
      expect(calculatePredictionBonus(PredictionType.MORE, 6, 2)).toBe(6);
      expect(calculatePredictionBonus(PredictionType.MORE, 0, 2)).toBe(0);
      expect(calculatePredictionBonus(PredictionType.MORE, 12, 2)).toBe(0);
    });

    it('MAX should match score 12 (sweep)', () => {
      expect(calculatePredictionBonus(PredictionType.MAX, 12, 2)).toBe(12);
      expect(calculatePredictionBonus(PredictionType.MAX, 6, 2)).toBe(0);
    });

    it('MIN should not match any score (not used in 2-player)', () => {
      expect(calculatePredictionBonus(PredictionType.MIN, 0, 2)).toBe(0);
      expect(calculatePredictionBonus(PredictionType.MIN, 6, 2)).toBe(0);
      expect(calculatePredictionBonus(PredictionType.MIN, 12, 2)).toBe(0);
    });
  });

  describe('3 players - predictions', () => {
    it('ZERO should match score 0', () => {
      expect(calculatePredictionBonus(PredictionType.ZERO, 0, 3)).toBe(40);
    });

    it('MIN should match score 3', () => {
      expect(calculatePredictionBonus(PredictionType.MIN, 3, 3)).toBe(3);
      expect(calculatePredictionBonus(PredictionType.MIN, 0, 3)).toBe(0);
      expect(calculatePredictionBonus(PredictionType.MIN, 6, 3)).toBe(0);
    });

    it('MORE should match scores 6-9', () => {
      expect(calculatePredictionBonus(PredictionType.MORE, 6, 3)).toBe(6);
      expect(calculatePredictionBonus(PredictionType.MORE, 9, 3)).toBe(9);
      expect(calculatePredictionBonus(PredictionType.MORE, 3, 3)).toBe(0);
      expect(calculatePredictionBonus(PredictionType.MORE, 12, 3)).toBe(0);
    });

    it('MAX should match scores 10-12', () => {
      // Note: For 3 players, only 12 is achievable in 10-12 range
      expect(calculatePredictionBonus(PredictionType.MAX, 10, 3)).toBe(10);
      expect(calculatePredictionBonus(PredictionType.MAX, 12, 3)).toBe(12);
      expect(calculatePredictionBonus(PredictionType.MAX, 9, 3)).toBe(0);
      expect(calculatePredictionBonus(PredictionType.MAX, 6, 3)).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle boundary values correctly for 4 players', () => {
      // MIN boundaries
      expect(calculatePredictionBonus(PredictionType.MIN, 1, 4)).toBe(1);
      expect(calculatePredictionBonus(PredictionType.MIN, 4, 4)).toBe(4);

      // MORE boundaries
      expect(calculatePredictionBonus(PredictionType.MORE, 6, 4)).toBe(6);
      expect(calculatePredictionBonus(PredictionType.MORE, 9, 4)).toBe(9);

      // MAX is 10-12
      expect(calculatePredictionBonus(PredictionType.MAX, 10, 4)).toBe(10);
      expect(calculatePredictionBonus(PredictionType.MAX, 12, 4)).toBe(12);
      expect(calculatePredictionBonus(PredictionType.MAX, 9, 4)).toBe(0);
    });
  });
});
