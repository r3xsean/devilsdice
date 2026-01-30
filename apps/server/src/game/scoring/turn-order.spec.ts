import { Player, DieColor, PredictionType } from '@devilsdice/shared';
import { calculateInitialTurnOrder, calculateTurnOrder } from './turn-order';

// Helper to create a minimal player for testing
function createPlayer(
  id: string,
  cumulativeScore: number,
  overrides: Partial<Player> = {},
): Player {
  return {
    id,
    name: `Player ${id}`,
    socketId: `socket-${id}`,
    dice: [],
    cumulativeScore,
    currentRoundScore: 0,
    set1Score: 0,
    set2Score: 0,
    prediction: null,
    isConnected: true,
    isReady: true,
    isHost: false,
    ...overrides,
  };
}

describe('calculateInitialTurnOrder', () => {
  describe('Basic ordering', () => {
    it('should sort by roll ascending (lowest goes first)', () => {
      const rollResults = [
        { playerId: 'p1', roll: 5 },
        { playerId: 'p2', roll: 2 },
        { playerId: 'p3', roll: 4 },
        { playerId: 'p4', roll: 1 },
      ];

      const order = calculateInitialTurnOrder(rollResults);

      expect(order).toEqual(['p4', 'p2', 'p3', 'p1']);
    });

    it('should handle 2 players', () => {
      const rollResults = [
        { playerId: 'p1', roll: 6 },
        { playerId: 'p2', roll: 3 },
      ];

      const order = calculateInitialTurnOrder(rollResults);

      expect(order).toEqual(['p2', 'p1']);
    });

    it('should handle single player', () => {
      const rollResults = [{ playerId: 'p1', roll: 4 }];

      const order = calculateInitialTurnOrder(rollResults);

      expect(order).toEqual(['p1']);
    });

    it('should handle empty array', () => {
      const order = calculateInitialTurnOrder([]);

      expect(order).toEqual([]);
    });
  });

  describe('Tie handling', () => {
    it('should maintain relative order for tied rolls', () => {
      const rollResults = [
        { playerId: 'p1', roll: 3 },
        { playerId: 'p2', roll: 3 },
        { playerId: 'p3', roll: 1 },
      ];

      const order = calculateInitialTurnOrder(rollResults);

      // p3 should be first (lowest roll)
      expect(order[0]).toBe('p3');
      // p1 and p2 are tied, their relative order depends on sort stability
      expect(order.slice(1).sort()).toEqual(['p1', 'p2']);
    });

    it('should handle all players with same roll', () => {
      const rollResults = [
        { playerId: 'p1', roll: 4 },
        { playerId: 'p2', roll: 4 },
        { playerId: 'p3', roll: 4 },
      ];

      const order = calculateInitialTurnOrder(rollResults);

      expect(order.length).toBe(3);
      expect(order.sort()).toEqual(['p1', 'p2', 'p3']);
    });
  });

  describe('Edge cases', () => {
    it('should handle minimum roll value (1)', () => {
      const rollResults = [
        { playerId: 'p1', roll: 1 },
        { playerId: 'p2', roll: 6 },
      ];

      const order = calculateInitialTurnOrder(rollResults);

      expect(order).toEqual(['p1', 'p2']);
    });

    it('should handle maximum roll value (6)', () => {
      const rollResults = [
        { playerId: 'p1', roll: 6 },
        { playerId: 'p2', roll: 1 },
      ];

      const order = calculateInitialTurnOrder(rollResults);

      expect(order).toEqual(['p2', 'p1']);
    });

    it('should not mutate the original array', () => {
      const rollResults = [
        { playerId: 'p1', roll: 5 },
        { playerId: 'p2', roll: 2 },
      ];
      const originalOrder = [...rollResults];

      calculateInitialTurnOrder(rollResults);

      expect(rollResults).toEqual(originalOrder);
    });
  });
});

describe('calculateTurnOrder', () => {
  describe('Basic ordering', () => {
    it('should sort by cumulative score descending (highest goes first)', () => {
      const players = [
        createPlayer('p1', 10),
        createPlayer('p2', 25),
        createPlayer('p3', 15),
        createPlayer('p4', 5),
      ];
      const originalOrder = ['p4', 'p1', 'p3', 'p2'];

      const order = calculateTurnOrder(players, originalOrder);

      expect(order).toEqual(['p2', 'p3', 'p1', 'p4']);
    });

    it('should handle 2 players', () => {
      const players = [createPlayer('p1', 5), createPlayer('p2', 12)];
      const originalOrder = ['p1', 'p2'];

      const order = calculateTurnOrder(players, originalOrder);

      expect(order).toEqual(['p2', 'p1']);
    });

    it('should handle single player', () => {
      const players = [createPlayer('p1', 10)];
      const originalOrder = ['p1'];

      const order = calculateTurnOrder(players, originalOrder);

      expect(order).toEqual(['p1']);
    });
  });

  describe('Tie handling with original order tiebreaker', () => {
    it('should use original order as tiebreaker for equal scores', () => {
      const players = [
        createPlayer('p1', 15),
        createPlayer('p2', 15),
        createPlayer('p3', 15),
      ];
      const originalOrder = ['p3', 'p1', 'p2']; // p3 was first in initial roll

      const order = calculateTurnOrder(players, originalOrder);

      // All have same score, so order should match original order
      expect(order).toEqual(['p3', 'p1', 'p2']);
    });

    it('should maintain tiebreaker for middle placements', () => {
      const players = [
        createPlayer('p1', 20),
        createPlayer('p2', 15),
        createPlayer('p3', 15),
        createPlayer('p4', 10),
      ];
      const originalOrder = ['p3', 'p2', 'p1', 'p4'];

      const order = calculateTurnOrder(players, originalOrder);

      // p1 first (highest score)
      expect(order[0]).toBe('p1');
      // p2 and p3 tied, p3 was earlier in original order
      expect(order[1]).toBe('p3');
      expect(order[2]).toBe('p2');
      // p4 last (lowest score)
      expect(order[3]).toBe('p4');
    });

    it('should handle multiple groups of tied players', () => {
      const players = [
        createPlayer('p1', 20),
        createPlayer('p2', 20),
        createPlayer('p3', 10),
        createPlayer('p4', 10),
      ];
      const originalOrder = ['p4', 'p2', 'p1', 'p3'];

      const order = calculateTurnOrder(players, originalOrder);

      // p1 and p2 tied for first, p2 earlier in original
      expect(order[0]).toBe('p2');
      expect(order[1]).toBe('p1');
      // p3 and p4 tied for last, p4 earlier in original
      expect(order[2]).toBe('p4');
      expect(order[3]).toBe('p3');
    });
  });

  describe('Edge cases', () => {
    it('should handle players with zero score', () => {
      const players = [
        createPlayer('p1', 0),
        createPlayer('p2', 5),
        createPlayer('p3', 0),
      ];
      const originalOrder = ['p1', 'p2', 'p3'];

      const order = calculateTurnOrder(players, originalOrder);

      expect(order[0]).toBe('p2');
      // p1 and p3 tied at 0, p1 earlier in original
      expect(order[1]).toBe('p1');
      expect(order[2]).toBe('p3');
    });

    it('should handle player not in original order (defaults to end)', () => {
      const players = [
        createPlayer('p1', 10),
        createPlayer('p2', 10),
        createPlayer('p3', 10),
      ];
      const originalOrder = ['p1', 'p2']; // p3 missing from original

      const order = calculateTurnOrder(players, originalOrder);

      // p1 and p2 tied and in original order, p3 not in original
      expect(order[0]).toBe('p1');
      expect(order[1]).toBe('p2');
      expect(order[2]).toBe('p3');
    });

    it('should not mutate original arrays', () => {
      const players = [createPlayer('p1', 5), createPlayer('p2', 10)];
      const originalOrder = ['p1', 'p2'];
      const originalPlayers = [...players];
      const originalOrderCopy = [...originalOrder];

      calculateTurnOrder(players, originalOrder);

      expect(players).toEqual(originalPlayers);
      expect(originalOrder).toEqual(originalOrderCopy);
    });

    it('should handle empty arrays', () => {
      const order = calculateTurnOrder([], []);

      expect(order).toEqual([]);
    });

    it('should handle large score differences', () => {
      const players = [
        createPlayer('p1', 1000),
        createPlayer('p2', 1),
        createPlayer('p3', 500),
      ];
      const originalOrder = ['p2', 'p3', 'p1'];

      const order = calculateTurnOrder(players, originalOrder);

      expect(order).toEqual(['p1', 'p3', 'p2']);
    });
  });
});
