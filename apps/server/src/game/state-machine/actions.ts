import { v4 as uuidv4 } from 'uuid';
import {
  Die,
  DieColor,
  GamePhase,
  PredictionType,
  GAME_LIMITS,
  getAvailablePredictions,
} from '@devilsdice/shared';
import { GameMachineContext } from './types';
import {
  evaluateHand,
  calculateSetPlacements,
  calculatePredictionBonus,
  calculateInitialTurnOrder,
  calculateTurnOrder,
} from '../scoring';

/**
 * Generate a random die value (1-6)
 */
function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * Create a new die with random value
 */
function createDie(color: DieColor): Die {
  return {
    id: uuidv4(),
    color,
    value: rollDie(),
    isSpent: false,
    isRevealed: color === DieColor.WHITE, // White dice are revealed, hidden dice are not
  };
}

/**
 * Generate all 11 dice for a player (9 white, 1 red, 1 blue)
 */
function generatePlayerDice(): Die[] {
  const dice: Die[] = [];

  // 9 white dice (revealed)
  for (let i = 0; i < GAME_LIMITS.WHITE_DICE_COUNT; i++) {
    dice.push(createDie(DieColor.WHITE));
  }

  // 1 red die (hidden)
  dice.push(createDie(DieColor.RED));

  // 1 blue die (hidden)
  dice.push(createDie(DieColor.BLUE));

  return dice;
}

/**
 * Roll all dice for all players (11 dice per player)
 */
export function rollAllDice({
  context,
}: {
  context: GameMachineContext;
}): GameMachineContext {
  const newGameState = { ...context.gameState };
  newGameState.players = newGameState.players.map((player) => ({
    ...player,
    dice: generatePlayerDice(),
  }));

  return {
    ...context,
    gameState: newGameState,
  };
}

/**
 * Roll 2 dice per player for initial turn order determination
 */
export function rollInitialTurnOrder({
  context,
}: {
  context: GameMachineContext;
}): GameMachineContext {
  const newGameState = { ...context.gameState };

  // Generate roll results for each player (sum of 2 dice)
  const rollResults = newGameState.players.map((player) => ({
    playerId: player.id,
    roll: rollDie() + rollDie(),
  }));

  newGameState.initialRollResults = rollResults;

  return {
    ...context,
    gameState: newGameState,
  };
}

/**
 * Set turn order based on initial roll (lowest first) or score (highest first)
 */
export function setTurnOrder({
  context,
}: {
  context: GameMachineContext;
}): GameMachineContext {
  const newGameState = { ...context.gameState };

  if (
    newGameState.currentRound === 1 &&
    newGameState.initialRollResults.length > 0
  ) {
    // Round 1: use initial roll order (lowest first)
    newGameState.turnOrder = calculateInitialTurnOrder(
      newGameState.initialRollResults,
    );
  } else {
    // Subsequent rounds: highest score first
    // Need to preserve original order for tiebreakers
    const originalOrder = calculateInitialTurnOrder(
      newGameState.initialRollResults,
    );
    newGameState.turnOrder = calculateTurnOrder(
      newGameState.players,
      originalOrder,
    );
  }

  newGameState.currentTurnIndex = 0;

  return {
    ...context,
    gameState: newGameState,
  };
}

/**
 * Process set selection - evaluate hands and calculate placements/scores
 */
export function processSetSelection({
  context,
}: {
  context: GameMachineContext;
}): GameMachineContext {
  const newGameState = { ...context.gameState };
  const { pendingSelections, players, currentSet } = newGameState;

  // Build selections for scoring
  const selections = players.map((player) => {
    const dieIds = pendingSelections[player.id] || [];
    const selectedDice = dieIds
      .map((id) => player.dice.find((d) => d.id === id))
      .filter((d): d is Die => d !== undefined);

    // Mark dice as revealed for display purposes
    const revealedDice = selectedDice.map((die) => ({
      ...die,
      isRevealed: true,
    }));

    return {
      playerId: player.id,
      hand: evaluateHand(selectedDice),
      diceUsed: dieIds,
      diceValues: revealedDice,
    };
  });

  // Calculate placements and points (pass player count for scaled scoring)
  const playerCount = players.length;
  const setResults = calculateSetPlacements(selections, playerCount);

  // Update player scores and mark dice as spent
  newGameState.players = players.map((player) => {
    const result = setResults.find((r) => r.playerId === player.id);
    const pointsEarned = result?.pointsEarned || 0;
    const dieIds = pendingSelections[player.id] || [];

    // Mark selected dice as spent
    const updatedDice = player.dice.map((die) => ({
      ...die,
      isSpent: die.isSpent || dieIds.includes(die.id),
      // Reveal hidden dice when used
      isRevealed: die.isRevealed || dieIds.includes(die.id),
    }));

    // Update set score
    const set1Score = currentSet === 1 ? pointsEarned : player.set1Score;
    const set2Score = currentSet === 2 ? pointsEarned : player.set2Score;

    return {
      ...player,
      dice: updatedDice,
      set1Score,
      set2Score,
      currentRoundScore: set1Score + set2Score,
    };
  });

  // Store set results
  newGameState.setResults = setResults;

  return {
    ...context,
    gameState: newGameState,
  };
}

/**
 * Process predictions at round end and calculate bonuses
 */
export function processPredictions({
  context,
}: {
  context: GameMachineContext;
}): GameMachineContext {
  const newGameState = { ...context.gameState };
  const playerCount = newGameState.players.length;

  const predictions = newGameState.players.map((player) => {
    const roundTotal = player.currentRoundScore;
    const prediction = player.prediction!;
    const bonus = calculatePredictionBonus(prediction, roundTotal, playerCount);
    const correct = bonus > 0;

    return {
      playerId: player.id,
      type: prediction,
      correct,
      bonus,
    };
  });

  // Apply prediction bonuses to cumulative scores
  newGameState.players = newGameState.players.map((player) => {
    const predictionResult = predictions.find((p) => p.playerId === player.id);
    const bonus = predictionResult?.bonus || 0;

    return {
      ...player,
      cumulativeScore:
        player.cumulativeScore + player.currentRoundScore + bonus,
    };
  });

  // Store round history
  const roundResult = {
    roundNumber: newGameState.currentRound,
    set1Results:
      newGameState.roundHistory.length > 0
        ? newGameState.roundHistory[newGameState.roundHistory.length - 1]
            ?.set1Results || []
        : [],
    set2Results: newGameState.setResults,
    predictions,
  };

  // Update set1Results with the stored results from set 1
  if (newGameState.currentSet === 2) {
    // We need to retrieve set1 results - they should have been stored
    // For now, we'll use the setResults that were stored during set 1
  }

  newGameState.roundHistory = [...newGameState.roundHistory, roundResult];

  return {
    ...context,
    gameState: newGameState,
  };
}

/**
 * Advance to next player's turn
 */
export function advanceTurn({
  context,
}: {
  context: GameMachineContext;
}): GameMachineContext {
  const newGameState = { ...context.gameState };
  newGameState.currentTurnIndex = newGameState.currentTurnIndex + 1;

  return {
    ...context,
    gameState: newGameState,
  };
}

/**
 * Advance to set 2
 */
export function advanceSet({
  context,
}: {
  context: GameMachineContext;
}): GameMachineContext {
  const newGameState = { ...context.gameState };

  // Store set 1 results before clearing
  const set1Results = [...newGameState.setResults];

  // Update round history with set 1 results
  if (newGameState.roundHistory.length > 0) {
    const lastRound =
      newGameState.roundHistory[newGameState.roundHistory.length - 1];
    lastRound.set1Results = set1Results;
  }

  newGameState.currentSet = 2;
  newGameState.currentTurnIndex = 0;
  newGameState.setResults = [];

  // Clear pending selections and confirmations for set 2
  newGameState.pendingSelections = {};

  return {
    ...context,
    gameState: newGameState,
  };
}

/**
 * Advance to next round
 */
export function advanceRound({
  context,
}: {
  context: GameMachineContext;
}): GameMachineContext {
  const newGameState = { ...context.gameState };

  newGameState.currentRound = newGameState.currentRound + 1;
  newGameState.currentSet = 1;
  newGameState.currentTurnIndex = 0;
  newGameState.setResults = [];
  newGameState.pendingSelections = {};

  // Roll new dice for all players
  newGameState.players = newGameState.players.map((player) => ({
    ...player,
    dice: generatePlayerDice(),
  }));

  return {
    ...context,
    gameState: newGameState,
  };
}

/**
 * Reset player round state for new round
 */
export function resetPlayerRoundState({
  context,
}: {
  context: GameMachineContext;
}): GameMachineContext {
  const newGameState = { ...context.gameState };

  newGameState.players = newGameState.players.map((player) => ({
    ...player,
    set1Score: 0,
    set2Score: 0,
    currentRoundScore: 0,
    prediction: null,
  }));

  return {
    ...context,
    gameState: newGameState,
  };
}

/**
 * Update game phase in context
 */
export function setPhase(phase: GamePhase) {
  return ({ context }: { context: GameMachineContext }): GameMachineContext => {
    const newGameState = { ...context.gameState };
    newGameState.phase = phase;

    return {
      ...context,
      gameState: newGameState,
    };
  };
}

/**
 * Store a player's prediction
 */
export function storePrediction({
  context,
  event,
}: {
  context: GameMachineContext;
  event: {
    type: 'SUBMIT_PREDICTION';
    playerId: string;
    prediction: PredictionType;
  };
}): GameMachineContext {
  const newGameState = { ...context.gameState };

  newGameState.players = newGameState.players.map((player) => {
    if (player.id === event.playerId) {
      return { ...player, prediction: event.prediction };
    }
    return player;
  });

  return {
    ...context,
    gameState: newGameState,
  };
}

/**
 * Store a player's dice selection
 */
export function storeDiceSelection({
  context,
  event,
}: {
  context: GameMachineContext;
  event: { type: 'SELECT_DICE'; playerId: string; dieIds: string[] };
}): GameMachineContext {
  const newGameState = { ...context.gameState };

  newGameState.pendingSelections = {
    ...newGameState.pendingSelections,
    [event.playerId]: event.dieIds,
  };

  return {
    ...context,
    gameState: newGameState,
  };
}

/**
 * Confirm a player's selection and advance to next player's turn
 */
export function confirmSelection({
  context,
  event,
}: {
  context: GameMachineContext;
  event: { type: 'CONFIRM_SELECTION'; playerId: string };
}): GameMachineContext {
  const newGameState = { ...context.gameState };

  // Mark this player's selection as confirmed using a special key
  newGameState.pendingSelections = {
    ...newGameState.pendingSelections,
    [`${event.playerId}:confirmed`]: ['confirmed'],
  };

  // Advance turn index if this was the current player
  const currentPlayerId = newGameState.turnOrder[newGameState.currentTurnIndex];
  if (currentPlayerId === event.playerId) {
    newGameState.currentTurnIndex = newGameState.currentTurnIndex + 1;
  }

  return {
    ...context,
    gameState: newGameState,
  };
}

/**
 * Auto-select dice for a player on timeout and advance to next turn
 */
export function autoSelectDice({
  context,
}: {
  context: GameMachineContext;
}): GameMachineContext {
  const newGameState = { ...context.gameState };
  const currentPlayerId = newGameState.turnOrder[newGameState.currentTurnIndex];
  const player = newGameState.players.find((p) => p.id === currentPlayerId);

  if (!player) {
    return context;
  }

  // Get available (unspent) dice
  const availableDice = player.dice.filter((d) => !d.isSpent);

  // Auto-select first 3 available dice
  const selectedDieIds = availableDice.slice(0, 3).map((d) => d.id);

  newGameState.pendingSelections = {
    ...newGameState.pendingSelections,
    [currentPlayerId]: selectedDieIds,
    [`${currentPlayerId}:confirmed`]: ['confirmed'],
  };

  // Advance to next player's turn
  newGameState.currentTurnIndex = newGameState.currentTurnIndex + 1;

  return {
    ...context,
    gameState: newGameState,
  };
}

/**
 * Clear turn timer
 */
export function clearTurnTimer({
  context,
}: {
  context: GameMachineContext;
}): GameMachineContext {
  if (context.turnTimerId) {
    clearTimeout(context.turnTimerId);
  }

  return {
    ...context,
    turnTimerId: null,
    turnTimeRemaining: 0,
  };
}

/**
 * Auto-submit predictions for players who haven't submitted yet
 * Picks a random prediction from available options based on player count
 */
export function autoSubmitPredictions({
  context,
}: {
  context: GameMachineContext;
}): GameMachineContext {
  const newGameState = { ...context.gameState };
  const playerCount = newGameState.players.length;
  const availablePredictions = getAvailablePredictions(playerCount);

  newGameState.players = newGameState.players.map((player) => {
    if (player.prediction === null) {
      // Auto-pick a random prediction from available options for this player count
      const randomPrediction =
        availablePredictions[Math.floor(Math.random() * availablePredictions.length)];
      return { ...player, prediction: randomPrediction };
    }
    return player;
  });

  return {
    ...context,
    gameState: newGameState,
  };
}

/**
 * All actions exported as an object for use in setup()
 */
export const actions = {
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
  autoSubmitPredictions,
};
