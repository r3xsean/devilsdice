import { GameState, GamePhase, PredictionType } from '@devilsdice/shared';

/**
 * Machine context - extends GameState with machine-specific state
 */
export interface GameMachineContext {
  gameState: GameState;
  turnTimerId: NodeJS.Timeout | null;
  turnTimeRemaining: number;
}

/**
 * Events that can be sent to the state machine
 */
export type GameMachineEvent =
  | { type: 'START_GAME' }
  | { type: 'INITIAL_ROLL_COMPLETE' }
  | { type: 'SUBMIT_PREDICTION'; playerId: string; prediction: PredictionType }
  | { type: 'PREDICTION_TIMEOUT' }
  | { type: 'SELECT_DICE'; playerId: string; dieIds: string[] }
  | { type: 'CONFIRM_SELECTION'; playerId: string }
  | { type: 'TURN_TIMEOUT' }
  | { type: 'NEXT_SET' }
  | { type: 'NEXT_ROUND' }
  | { type: 'END_GAME' };

/**
 * State values for the machine
 */
export type GameMachineState =
  | { value: 'lobby'; context: GameMachineContext }
  | { value: 'initial_roll'; context: GameMachineContext }
  | { value: 'prediction'; context: GameMachineContext }
  | { value: 'set_selection'; context: GameMachineContext }
  | { value: 'set_reveal'; context: GameMachineContext }
  | { value: 'round_summary'; context: GameMachineContext }
  | { value: 'game_over'; context: GameMachineContext };

/**
 * Input for creating a new machine instance
 */
export interface GameMachineInput {
  gameState: GameState;
}

/**
 * Selection tracking for a player
 */
export interface PlayerSelection {
  playerId: string;
  dieIds: string[];
  confirmed: boolean;
}

/**
 * Callback for state changes
 */
export type StateChangeCallback = (
  phase: GamePhase,
  gameState: GameState,
) => void;

/**
 * Callback for turn timer updates
 */
export type TurnTimerCallback = (
  playerId: string,
  timeRemaining: number,
) => void;
