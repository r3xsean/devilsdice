// State machine
export {
  gameMachine,
  createGameActor,
  getStateValue,
  getGameStateFromActor,
  type GameMachineActor,
} from './game.machine';

// Types
export type {
  GameMachineContext,
  GameMachineEvent,
  GameMachineState,
  GameMachineInput,
  PlayerSelection,
  StateChangeCallback,
  TurnTimerCallback,
} from './types';

// Guards
export { guards } from './guards';
export {
  allPlayersRolled,
  allPredictionsSubmitted,
  allSelectionsConfirmed,
  isSet1,
  isSet2,
  hasMoreRounds,
  isGameOver,
} from './guards';

// Actions
export { actions } from './actions';
export {
  rollAllDice,
  rollInitialTurnOrder,
  setTurnOrder,
  processSetSelection,
  processPredictions,
  advanceTurn,
  advanceSet,
  advanceRound,
  resetPlayerRoundState,
  storePrediction,
  storeDiceSelection,
  confirmSelection,
  autoSelectDice,
  clearTurnTimer,
} from './actions';
