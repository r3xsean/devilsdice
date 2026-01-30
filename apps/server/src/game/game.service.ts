import { Injectable, Logger } from '@nestjs/common';
import {
  GameState,
  GamePhase,
  PredictionType,
  GAME_LIMITS,
} from '@devilsdice/shared';
import { RedisService } from '../redis/redis.service';
import { RoomService } from './room.service';
import {
  createGameActor,
  getGameStateFromActor,
  GameMachineActor,
} from './state-machine';

export class GameError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'GameError';
  }
}

export interface StateChangeHandler {
  (roomCode: string, phase: GamePhase, gameState: GameState): void;
}

export interface TurnTimerHandler {
  (roomCode: string, playerId: string, timeRemaining: number): void;
}

export interface AutoSelectionHandler {
  (roomCode: string, playerId: string, dieIds: string[], gameState: GameState): void;
}

export interface PredictionTimerHandler {
  (roomCode: string, timeRemaining: number): void;
}

export interface AutoPredictionHandler {
  (roomCode: string, playerIds: string[], predictions: Record<string, PredictionType>, gameState: GameState): void;
}

export interface AutoSubmittingHandler {
  (roomCode: string, countdown: number): void;
}

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  // Map of room codes to their state machine actors
  private readonly gameActors = new Map<string, GameMachineActor>();

  // Map of room codes to their turn timer IDs
  private readonly turnTimers = new Map<string, NodeJS.Timeout>();

  // Map of room codes to their prediction timer IDs
  private readonly predictionTimers = new Map<string, NodeJS.Timeout>();

  // State change callback
  private stateChangeHandler: StateChangeHandler | null = null;

  // Turn timer callback
  private turnTimerHandler: TurnTimerHandler | null = null;

  // Auto-selection callback (for timeout)
  private autoSelectionHandler: AutoSelectionHandler | null = null;

  // Prediction timer callback
  private predictionTimerHandler: PredictionTimerHandler | null = null;

  // Auto-prediction callback (for timeout)
  private autoPredictionHandler: AutoPredictionHandler | null = null;

  // Auto-submitting countdown callback
  private autoSubmittingHandler: AutoSubmittingHandler | null = null;

  constructor(
    private readonly redisService: RedisService,
    private readonly roomService: RoomService,
  ) {}

  /**
   * Set the state change handler (called by gateway)
   */
  setStateChangeHandler(handler: StateChangeHandler): void {
    this.stateChangeHandler = handler;
  }

  /**
   * Set the turn timer handler (called by gateway)
   */
  setTurnTimerHandler(handler: TurnTimerHandler): void {
    this.turnTimerHandler = handler;
  }

  /**
   * Set the auto-selection handler (called by gateway)
   */
  setAutoSelectionHandler(handler: AutoSelectionHandler): void {
    this.autoSelectionHandler = handler;
  }

  /**
   * Set the prediction timer handler (called by gateway)
   */
  setPredictionTimerHandler(handler: PredictionTimerHandler): void {
    this.predictionTimerHandler = handler;
  }

  /**
   * Set the auto-prediction handler (called by gateway)
   */
  setAutoPredictionHandler(handler: AutoPredictionHandler): void {
    this.autoPredictionHandler = handler;
  }

  /**
   * Set the auto-submitting handler (called by gateway)
   */
  setAutoSubmittingHandler(handler: AutoSubmittingHandler): void {
    this.autoSubmittingHandler = handler;
  }

  /**
   * Start a game for a room
   */
  async startGame(roomCode: string, playerId: string): Promise<GameState> {
    // First use room service to validate and transition to initial roll
    const gameState = await this.roomService.startGame(roomCode, playerId);

    // Create a new state machine actor
    const actor = createGameActor(gameState);

    // Subscribe to state changes
    actor.subscribe((snapshot) => {
      const currentState = snapshot.context.gameState;
      this.handleStateChange(roomCode, currentState.phase, currentState);
    });

    // Start the actor
    actor.start();

    // Store the actor
    this.gameActors.set(roomCode, actor);

    // Send START_GAME event to transition from lobby to initial_roll
    actor.send({ type: 'START_GAME' });

    const currentState = getGameStateFromActor(actor);
    await this.redisService.setGameState(roomCode, currentState);

    this.logger.log(`Game started for room ${roomCode}`);

    return currentState;
  }

  /**
   * Submit a prediction for a player
   */
  async submitPrediction(
    roomCode: string,
    playerId: string,
    prediction: PredictionType,
  ): Promise<GameState> {
    const actor = this.gameActors.get(roomCode);
    if (!actor) {
      throw new GameError('GAME_NOT_FOUND', 'Game not found or not started');
    }

    const snapshot = actor.getSnapshot();
    if (snapshot.value !== 'prediction') {
      throw new GameError('INVALID_PHASE', 'Not in prediction phase');
    }

    // Validate player exists
    const gameState = snapshot.context.gameState;
    const player = gameState.players.find((p) => p.id === playerId);
    if (!player) {
      throw new GameError('PLAYER_NOT_FOUND', 'Player not found in game');
    }

    // Validate prediction hasn't already been submitted
    if (player.prediction !== null) {
      throw new GameError(
        'PREDICTION_ALREADY_SUBMITTED',
        'Prediction already submitted',
      );
    }

    // Send the event
    actor.send({ type: 'SUBMIT_PREDICTION', playerId, prediction });

    const currentState = getGameStateFromActor(actor);
    await this.redisService.setGameState(roomCode, currentState);

    this.logger.log(
      `Player ${playerId} submitted prediction ${prediction} in room ${roomCode}`,
    );

    return currentState;
  }

  /**
   * Select dice for a player
   */
  async selectDice(
    roomCode: string,
    playerId: string,
    dieIds: string[],
  ): Promise<GameState> {
    const actor = this.gameActors.get(roomCode);
    if (!actor) {
      throw new GameError('GAME_NOT_FOUND', 'Game not found or not started');
    }

    const snapshot = actor.getSnapshot();
    if (snapshot.value !== 'set_selection') {
      throw new GameError('INVALID_PHASE', 'Not in set selection phase');
    }

    const gameState = snapshot.context.gameState;

    // Validate it's this player's turn
    const currentPlayerId = gameState.turnOrder[gameState.currentTurnIndex];
    if (currentPlayerId !== playerId) {
      throw new GameError('NOT_YOUR_TURN', 'It is not your turn');
    }

    // Validate player exists
    const player = gameState.players.find((p) => p.id === playerId);
    if (!player) {
      throw new GameError('PLAYER_NOT_FOUND', 'Player not found in game');
    }

    // Validate exactly 3 dice selected
    if (dieIds.length !== GAME_LIMITS.DICE_PER_SELECTION) {
      throw new GameError(
        'INVALID_SELECTION',
        `Must select exactly ${GAME_LIMITS.DICE_PER_SELECTION} dice`,
      );
    }

    // Validate all dice belong to the player and are not spent
    for (const dieId of dieIds) {
      const die = player.dice.find((d) => d.id === dieId);
      if (!die) {
        throw new GameError('INVALID_DIE', `Die ${dieId} not found`);
      }
      if (die.isSpent) {
        throw new GameError(
          'DIE_ALREADY_SPENT',
          `Die ${dieId} has already been used`,
        );
      }
    }

    // Send the event
    actor.send({ type: 'SELECT_DICE', playerId, dieIds });

    const currentState = getGameStateFromActor(actor);
    await this.redisService.setGameState(roomCode, currentState);

    this.logger.log(`Player ${playerId} selected dice in room ${roomCode}`);

    return currentState;
  }

  /**
   * Confirm dice selection for a player
   */
  async confirmSelection(
    roomCode: string,
    playerId: string,
  ): Promise<GameState> {
    const actor = this.gameActors.get(roomCode);
    if (!actor) {
      throw new GameError('GAME_NOT_FOUND', 'Game not found or not started');
    }

    const snapshot = actor.getSnapshot();
    if (snapshot.value !== 'set_selection') {
      throw new GameError('INVALID_PHASE', 'Not in set selection phase');
    }

    const gameState = snapshot.context.gameState;

    // Validate player has selected dice
    const selection = gameState.pendingSelections[playerId];
    if (!selection || selection.length !== GAME_LIMITS.DICE_PER_SELECTION) {
      throw new GameError('NO_SELECTION', 'No dice selection to confirm');
    }

    // Check if already confirmed
    if (gameState.pendingSelections[`${playerId}:confirmed`]) {
      throw new GameError('ALREADY_CONFIRMED', 'Selection already confirmed');
    }

    // Send the event
    actor.send({ type: 'CONFIRM_SELECTION', playerId });

    // Advance turn if this was the current player
    const currentPlayerId = gameState.turnOrder[gameState.currentTurnIndex];
    if (currentPlayerId === playerId) {
      // Clear turn timer
      this.clearTurnTimer(roomCode);

      // Check if more players need to select
      const nextTurnIndex = gameState.currentTurnIndex + 1;
      if (nextTurnIndex < gameState.turnOrder.length) {
        // Start timer for next player
        const nextPlayerId = gameState.turnOrder[nextTurnIndex];
        this.startTurnTimer(roomCode, nextPlayerId);
      }
    }

    const currentState = getGameStateFromActor(actor);
    await this.redisService.setGameState(roomCode, currentState);

    this.logger.log(
      `Player ${playerId} confirmed selection in room ${roomCode}`,
    );

    return currentState;
  }

  /**
   * Trigger timeout for current player's turn
   */
  async triggerTurnTimeout(roomCode: string): Promise<GameState> {
    const actor = this.gameActors.get(roomCode);
    if (!actor) {
      throw new GameError('GAME_NOT_FOUND', 'Game not found or not started');
    }

    // Get the current player ID before timeout (they're the one being auto-selected)
    const stateBefore = getGameStateFromActor(actor);
    const timedOutPlayerId = stateBefore.turnOrder[stateBefore.currentTurnIndex];

    actor.send({ type: 'TURN_TIMEOUT' });

    const currentState = getGameStateFromActor(actor);
    await this.redisService.setGameState(roomCode, currentState);

    // Get the auto-selected dice IDs and notify via handler
    if (timedOutPlayerId && this.autoSelectionHandler) {
      const autoSelectedDieIds = currentState.pendingSelections[timedOutPlayerId] || [];
      if (autoSelectedDieIds.length > 0) {
        this.autoSelectionHandler(roomCode, timedOutPlayerId, autoSelectedDieIds, currentState);
      }
    }

    return currentState;
  }

  /**
   * Trigger timeout for prediction phase
   */
  async triggerPredictionTimeout(roomCode: string): Promise<GameState> {
    const actor = this.gameActors.get(roomCode);
    if (!actor) {
      throw new GameError('GAME_NOT_FOUND', 'Game not found or not started');
    }

    // Get players who haven't submitted predictions yet
    const stateBefore = getGameStateFromActor(actor);
    const playersWithoutPrediction = stateBefore.players
      .filter((p) => p.prediction === null)
      .map((p) => p.id);

    actor.send({ type: 'PREDICTION_TIMEOUT' });

    const currentState = getGameStateFromActor(actor);
    await this.redisService.setGameState(roomCode, currentState);

    // Notify about auto-predictions
    if (playersWithoutPrediction.length > 0 && this.autoPredictionHandler) {
      const predictions: Record<string, PredictionType> = {};
      for (const playerId of playersWithoutPrediction) {
        const player = currentState.players.find((p) => p.id === playerId);
        if (player?.prediction) {
          predictions[playerId] = player.prediction;
        }
      }
      this.autoPredictionHandler(roomCode, playersWithoutPrediction, predictions, currentState);
    }

    return currentState;
  }

  /**
   * Advance to next set (called after set reveal)
   */
  async advanceToNextSet(roomCode: string): Promise<GameState> {
    const actor = this.gameActors.get(roomCode);
    if (!actor) {
      throw new GameError('GAME_NOT_FOUND', 'Game not found or not started');
    }

    const snapshot = actor.getSnapshot();
    if (snapshot.value !== 'set_reveal') {
      throw new GameError('INVALID_PHASE', 'Not in set reveal phase');
    }

    actor.send({ type: 'NEXT_SET' });

    const currentState = getGameStateFromActor(actor);
    await this.redisService.setGameState(roomCode, currentState);

    // If we're now in set_selection, start the turn timer
    if (currentState.phase === GamePhase.SET_SELECTION) {
      const currentPlayerId =
        currentState.turnOrder[currentState.currentTurnIndex];
      this.startTurnTimer(roomCode, currentPlayerId);
    }

    return currentState;
  }

  /**
   * Advance to next round (called after round summary)
   */
  async advanceToNextRound(roomCode: string): Promise<GameState> {
    const actor = this.gameActors.get(roomCode);
    if (!actor) {
      throw new GameError('GAME_NOT_FOUND', 'Game not found or not started');
    }

    const snapshot = actor.getSnapshot();
    if (snapshot.value !== 'round_summary') {
      throw new GameError('INVALID_PHASE', 'Not in round summary phase');
    }

    actor.send({ type: 'NEXT_ROUND' });

    const currentState = getGameStateFromActor(actor);
    await this.redisService.setGameState(roomCode, currentState);

    return currentState;
  }

  /**
   * Get current game state
   */
  async getGameState(roomCode: string): Promise<GameState | null> {
    const actor = this.gameActors.get(roomCode);
    if (actor) {
      return getGameStateFromActor(actor);
    }

    // Fallback to Redis
    return this.redisService.getGameState(roomCode);
  }

  /**
   * Check if a game is active for a room
   */
  isGameActive(roomCode: string): boolean {
    return this.gameActors.has(roomCode);
  }

  /**
   * Start turn timer for a player
   */
  private startTurnTimer(roomCode: string, playerId: string): void {
    // Clear any existing timer
    this.clearTurnTimer(roomCode);

    const actor = this.gameActors.get(roomCode);
    if (!actor) return;

    const gameState = getGameStateFromActor(actor);
    const timerSeconds = gameState.config.turnTimerSeconds;

    let timeRemaining = timerSeconds;

    // Emit initial time
    this.turnTimerHandler?.(roomCode, playerId, timeRemaining);

    // Create countdown interval
    const intervalId = setInterval(() => {
      timeRemaining--;

      if (timeRemaining <= 0) {
        // Time's up - auto-select
        this.clearTurnTimer(roomCode);
        this.triggerTurnTimeout(roomCode).catch((err: Error) => {
          this.logger.error(`Error triggering turn timeout: ${err.message}`);
        });
      } else {
        // Emit time update
        this.turnTimerHandler?.(roomCode, playerId, timeRemaining);
      }
    }, 1000);

    this.turnTimers.set(roomCode, intervalId);
  }

  /**
   * Clear turn timer for a room
   */
  private clearTurnTimer(roomCode: string): void {
    const timerId = this.turnTimers.get(roomCode);
    if (timerId) {
      clearInterval(timerId);
      this.turnTimers.delete(roomCode);
    }
  }

  /**
   * Start prediction timer for a room
   */
  private startPredictionTimer(roomCode: string): void {
    // Clear any existing timer
    this.clearPredictionTimer(roomCode);

    const actor = this.gameActors.get(roomCode);
    if (!actor) return;

    const gameState = getGameStateFromActor(actor);
    const timerSeconds = gameState.config.turnTimerSeconds;

    let timeRemaining = timerSeconds;

    // Emit initial time
    this.predictionTimerHandler?.(roomCode, timeRemaining);

    // Create countdown interval
    const intervalId = setInterval(() => {
      timeRemaining--;

      if (timeRemaining <= 0) {
        // Time's up - clear timer and start 3-second countdown before auto-submit
        this.clearPredictionTimer(roomCode);

        // Emit 0 to indicate time is up
        this.predictionTimerHandler?.(roomCode, 0);

        // Notify clients that auto-submission is starting
        const countdownSeconds = Math.floor(GAME_LIMITS.REVEAL_DELAY_MS / 1000);
        this.autoSubmittingHandler?.(roomCode, countdownSeconds);

        // Wait 3 seconds before auto-submitting to give players visual feedback
        const delayTimerId = setTimeout(() => {
          this.triggerPredictionTimeout(roomCode).catch((err: Error) => {
            this.logger.error(`Error triggering prediction timeout: ${err.message}`);
          });
        }, GAME_LIMITS.REVEAL_DELAY_MS); // 3 seconds delay

        // Store the delay timer for cleanup
        this.predictionTimers.set(roomCode, delayTimerId);
      } else {
        // Emit time update
        this.predictionTimerHandler?.(roomCode, timeRemaining);
      }
    }, 1000);

    this.predictionTimers.set(roomCode, intervalId);
  }

  /**
   * Clear prediction timer for a room
   */
  private clearPredictionTimer(roomCode: string): void {
    const timerId = this.predictionTimers.get(roomCode);
    if (timerId) {
      clearInterval(timerId);
      this.predictionTimers.delete(roomCode);
    }
  }

  /**
   * Handle state changes from the machine
   */
  private handleStateChange(
    roomCode: string,
    phase: GamePhase,
    gameState: GameState,
  ): void {
    this.logger.debug(`State change in room ${roomCode}: ${phase}`);

    // Start prediction timer when entering prediction phase
    if (phase === GamePhase.PREDICTION) {
      this.startPredictionTimer(roomCode);
    }

    // Clear prediction timer when leaving prediction phase
    if (phase !== GamePhase.PREDICTION) {
      this.clearPredictionTimer(roomCode);
    }

    // Start turn timer when entering set_selection
    if (phase === GamePhase.SET_SELECTION) {
      const currentPlayerId = gameState.turnOrder[gameState.currentTurnIndex];
      this.startTurnTimer(roomCode, currentPlayerId);
    }

    // Clear timer when leaving set_selection
    if (phase !== GamePhase.SET_SELECTION) {
      this.clearTurnTimer(roomCode);
    }

    // Notify listeners
    this.stateChangeHandler?.(roomCode, phase, gameState);
  }

  /**
   * Clean up a game (when room is deleted)
   */
  cleanupGame(roomCode: string): void {
    this.clearTurnTimer(roomCode);
    this.clearPredictionTimer(roomCode);

    const actor = this.gameActors.get(roomCode);
    if (actor) {
      actor.stop();
      this.gameActors.delete(roomCode);
    }

    this.logger.log(`Game cleaned up for room ${roomCode}`);
  }
}
