export enum DieColor {
  WHITE = 'white',
  RED = 'red',
  BLUE = 'blue',
}

export interface Die {
  id: string;
  color: DieColor;
  value: number; // 1-6
  isSpent: boolean;
  isRevealed: boolean;
}

export enum PredictionType {
  ZERO = 'ZERO',
  MIN = 'MIN',
  MORE = 'MORE',
  MAX = 'MAX',
}

export enum HandRank {
  SINGLE = 1,
  DOUBLE = 2,
  STRAIGHT = 3,
  TRIPLE = 4,
}

export interface EvaluatedHand {
  rank: HandRank;
  primaryValue: number; // Triple value, straight high, pair value, or high card
  secondaryValue: number; // Kicker for double, or 2nd highest for single
  tertiaryValue: number; // 3rd for single
  description: string; // Human-readable: "Triple 5s"
}

export interface SetResult {
  playerId: string;
  hand: EvaluatedHand;
  diceUsed: string[]; // Die IDs
  diceValues: Die[]; // Actual dice with values for display
  placement: number; // 1, 2, 3, 4+
  pointsEarned: number; // Can be decimal for ties
}

export enum GamePhase {
  LOBBY = 'lobby',
  INITIAL_ROLL = 'initial_roll',
  PREDICTION = 'prediction',
  SET_SELECTION = 'set_selection',
  SET_REVEAL = 'set_reveal',
  ROUND_SUMMARY = 'round_summary',
  GAME_OVER = 'game_over',
}

export interface GameConfig {
  maxPlayers: number; // 2-6
  totalRounds: number; // 3-10
  turnTimerSeconds: number; // 15-60
}

export interface RoundResult {
  roundNumber: number;
  set1Results: SetResult[];
  set2Results: SetResult[];
  predictions: {
    playerId: string;
    type: PredictionType;
    correct: boolean;
    bonus: number;
  }[];
}

// Note: Player is imported from player.types.ts
import type { Player } from './player.types';

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  players: Player[];
  config: GameConfig;
  currentRound: number; // 1-based
  currentSet: 1 | 2;
  turnOrder: string[]; // Player IDs in order
  currentTurnIndex: number;
  pendingSelections: Record<string, string[]>; // playerId -> dieIds
  setResults: SetResult[];
  roundHistory: RoundResult[];
  initialRollResults: { playerId: string; roll: number }[];
  hostId: string;
  createdAt: number;
}
