import { GameMachineContext } from './types';

/**
 * Check if all players have completed their initial roll
 */
export function allPlayersRolled({
  context,
}: {
  context: GameMachineContext;
}): boolean {
  const { gameState } = context;
  const playerCount = gameState.players.length;
  const rollCount = gameState.initialRollResults.length;
  return rollCount >= playerCount && playerCount > 0;
}

/**
 * Check if all players have submitted their predictions
 */
export function allPredictionsSubmitted({
  context,
}: {
  context: GameMachineContext;
}): boolean {
  const { gameState } = context;
  return gameState.players.every((player) => player.prediction !== null);
}

/**
 * Check if all players have confirmed their dice selection
 */
export function allSelectionsConfirmed({
  context,
}: {
  context: GameMachineContext;
}): boolean {
  const { gameState } = context;
  const { pendingSelections, players } = gameState;

  // Check that every player has exactly 3 dice selected and confirmed
  // We track confirmed selections by having exactly 3 dice in pendingSelections
  // and the selection being marked as confirmed (stored with a special key pattern)
  return players.every((player) => {
    const selection = pendingSelections[player.id];
    const confirmed = pendingSelections[`${player.id}:confirmed`];
    return selection && selection.length === 3 && confirmed;
  });
}

/**
 * Check if we are on set 1
 */
export function isSet1({ context }: { context: GameMachineContext }): boolean {
  return context.gameState.currentSet === 1;
}

/**
 * Check if we are on set 2
 */
export function isSet2({ context }: { context: GameMachineContext }): boolean {
  return context.gameState.currentSet === 2;
}

/**
 * Check if there are more rounds to play
 */
export function hasMoreRounds({
  context,
}: {
  context: GameMachineContext;
}): boolean {
  const { gameState } = context;
  return gameState.currentRound < gameState.config.totalRounds;
}

/**
 * Check if the game is over (all rounds complete)
 */
export function isGameOver({
  context,
}: {
  context: GameMachineContext;
}): boolean {
  const { gameState } = context;
  return gameState.currentRound >= gameState.config.totalRounds;
}

/**
 * Check if it's currently round 1
 */
export function isRound1({
  context,
}: {
  context: GameMachineContext;
}): boolean {
  return context.gameState.currentRound === 1;
}

/**
 * Check if the current turn is the last player's turn
 */
export function isLastPlayerTurn({
  context,
}: {
  context: GameMachineContext;
}): boolean {
  const { gameState } = context;
  return gameState.currentTurnIndex >= gameState.turnOrder.length - 1;
}

/**
 * All guards exported as an object for use in setup()
 */
export const guards = {
  allPlayersRolled,
  allPredictionsSubmitted,
  allSelectionsConfirmed,
  isSet1,
  isSet2,
  hasMoreRounds,
  isGameOver,
  isRound1,
  isLastPlayerTurn,
};
