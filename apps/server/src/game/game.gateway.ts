import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  GamePhase,
  GameState,
  PredictionType,
} from '@devilsdice/shared';
import { RedisService } from '../redis/redis.service';
import { RoomService, RoomError } from './room.service';
import { GameService, GameError } from './game.service';
import { CreateRoomDto, JoinRoomDto, UpdateConfigDto } from './dto/room.dto';

// Socket data that allows partial/undefined values during connection lifecycle
interface PartialSocketData {
  playerId?: string;
  roomCode?: string;
  reconnectToken?: string;
}

type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  PartialSocketData
>;

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server<ClientToServerEvents, ServerToClientEvents>;

  private readonly logger = new Logger(GameGateway.name);

  // Track which players have acknowledged results per room
  private resultsAcknowledgements: Map<string, Set<string>> = new Map();
  // Track timeouts for auto-advancing after results
  private resultsTimeouts: Map<string, NodeJS.Timeout> = new Map();
  // Timeout duration for auto-advance (30 seconds)
  private readonly RESULTS_TIMEOUT_MS = 30000;

  constructor(
    private readonly redisService: RedisService,
    private readonly roomService: RoomService,
    private readonly gameService: GameService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  afterInit(_server: Server): void {
    this.logger.log('WebSocket Gateway initialized');

    // Set up state change handler for GameService
    this.gameService.setStateChangeHandler(
      (roomCode: string, phase: GamePhase, gameState: GameState) => {
        this.handleGameStateChange(roomCode, phase, gameState);
      },
    );

    // Set up turn timer handler for GameService
    this.gameService.setTurnTimerHandler(
      (roomCode: string, playerId: string, timeRemaining: number) => {
        this.handleTurnTimerTick(roomCode, playerId, timeRemaining);
      },
    );

    // Set up auto-selection handler for GameService (timeout auto-select)
    this.gameService.setAutoSelectionHandler(
      (roomCode: string, playerId: string, dieIds: string[], gameState: GameState) => {
        this.handleAutoSelection(roomCode, playerId, dieIds, gameState);
      },
    );

    // Set up prediction timer handler for GameService
    this.gameService.setPredictionTimerHandler(
      (roomCode: string, timeRemaining: number) => {
        this.handlePredictionTimerTick(roomCode, timeRemaining);
      },
    );

    // Set up auto-prediction handler for GameService (prediction timeout)
    this.gameService.setAutoPredictionHandler(
      (
        roomCode: string,
        playerIds: string[],
        predictions: Record<string, PredictionType>,
        gameState: GameState,
      ) => {
        this.handleAutoPrediction(roomCode, playerIds, predictions, gameState);
      },
    );

    // Set up auto-submitting handler for GameService (prediction countdown)
    this.gameService.setAutoSubmittingHandler(
      (roomCode: string, countdown: number) => {
        this.handleAutoSubmitting(roomCode, countdown);
      },
    );
  }

  /**
   * Handle state changes from GameService and broadcast to clients
   */
  private handleGameStateChange(
    roomCode: string,
    phase: GamePhase,
    gameState: GameState,
  ): void {
    this.logger.debug(`Broadcasting phase change to ${roomCode}: ${phase}`);

    // Broadcast phase change to all players in the room
    this.server.to(roomCode).emit('game:phaseChange', { phase, gameState });

    // Handle specific phase transitions
    switch (phase) {
      case GamePhase.INITIAL_ROLL:
        // Send initial roll results
        if (gameState.initialRollResults.length > 0) {
          this.server.to(roomCode).emit('game:initialRoll', {
            results: gameState.initialRollResults,
            turnOrder: gameState.turnOrder,
          });
        }
        break;

      case GamePhase.PREDICTION:
        // Emit initial timer for prediction phase
        this.server.to(roomCode).emit('game:timerTick', {
          timeRemaining: gameState.config.turnTimerSeconds,
        });
        break;

      case GamePhase.SET_SELECTION:
        // Start turn for the first player
        if (gameState.turnOrder.length > 0) {
          const currentPlayerId =
            gameState.turnOrder[gameState.currentTurnIndex];
          this.server.to(roomCode).emit('game:turnStart', {
            playerId: currentPlayerId,
            timeRemaining: gameState.config.turnTimerSeconds,
          });
        }
        break;

      case GamePhase.SET_REVEAL:
        // Clear any previous acknowledgements for fresh tracking
        this.clearResultsAcknowledgements(roomCode);
        // Send set reveal results
        this.server.to(roomCode).emit('set:reveal', {
          results: gameState.setResults,
          gameState,
        });
        break;

      case GamePhase.ROUND_SUMMARY:
        // Clear any previous acknowledgements for fresh tracking
        this.clearResultsAcknowledgements(roomCode);
        // Send round complete notification
        if (gameState.roundHistory.length > 0) {
          const latestRound =
            gameState.roundHistory[gameState.roundHistory.length - 1];
          this.server.to(roomCode).emit('round:complete', {
            result: latestRound,
            gameState,
          });
        }
        break;

      case GamePhase.GAME_OVER:
        // Send game over with final standings
        const standings = gameState.players
          .map((p) => ({
            playerId: p.id,
            name: p.name,
            score: p.cumulativeScore,
          }))
          .sort((a, b) => b.score - a.score);

        this.server.to(roomCode).emit('game:over', { finalStandings: standings });
        break;
    }
  }

  /**
   * Handle turn timer ticks from GameService
   */
  private handleTurnTimerTick(
    roomCode: string,
    playerId: string,
    timeRemaining: number,
  ): void {
    this.server.to(roomCode).emit('game:timerTick', { timeRemaining });

    // If this is the start of a turn (full time remaining), also emit turnStart
    // This is handled by the phase change handler, so we only emit timerTick here
  }

  /**
   * Handle prediction timer ticks from GameService
   */
  private handlePredictionTimerTick(
    roomCode: string,
    timeRemaining: number,
  ): void {
    this.server.to(roomCode).emit('game:timerTick', { timeRemaining });
  }

  /**
   * Handle auto-submitting countdown from GameService
   */
  private handleAutoSubmitting(roomCode: string, countdown: number): void {
    this.logger.debug(
      `Auto-submitting predictions in ${countdown} seconds for room ${roomCode}`,
    );
    this.server.to(roomCode).emit('prediction:autoSubmitting', { countdown });
  }

  /**
   * Handle auto-prediction from GameService (when prediction timer expires)
   * Broadcasts prediction:submitted events for auto-predicted players
   */
  private handleAutoPrediction(
    roomCode: string,
    playerIds: string[],
    predictions: Record<string, PredictionType>,
    gameState: GameState,
  ): void {
    this.logger.debug(
      `Auto-submitting predictions for players ${playerIds.join(', ')} in room ${roomCode}`,
    );

    // Notify about each auto-prediction
    for (const playerId of playerIds) {
      this.server.to(roomCode).emit('prediction:submitted', { playerId });
    }

    // Check if all players have submitted (they should have after auto-prediction)
    const allSubmitted = gameState.players.every((p) => p.prediction !== null);
    if (allSubmitted) {
      this.server.to(roomCode).emit('prediction:allSubmitted');
    }

    // Broadcast the updated game state
    this.server.to(roomCode).emit('game:stateUpdate', { gameState });
  }

  /**
   * Handle auto-selection from GameService (when turn timer expires)
   * Broadcasts dice:selected and dice:confirmed events for the auto-selected player
   */
  private handleAutoSelection(
    roomCode: string,
    playerId: string,
    dieIds: string[],
    gameState: GameState,
  ): void {
    this.logger.debug(`Auto-selecting dice for player ${playerId} in room ${roomCode}`);

    // Find the player to get their dice info
    const player = gameState.players.find((p) => p.id === playerId);
    if (player) {
      // Get the selected dice
      const selectedDice = dieIds
        .map((id) => player.dice.find((d) => d.id === id))
        .filter((d) => d !== undefined);

      // Only show visible (white) dice to opponents
      const visibleDice = selectedDice.filter((d) => d!.isRevealed);
      const hiddenCount = selectedDice.length - visibleDice.length;

      // Broadcast dice:selected to all players
      this.server.to(roomCode).emit('dice:selected', {
        playerId,
        visibleDice: visibleDice as import('@devilsdice/shared').Die[],
        hiddenCount,
      });
    }

    // Broadcast dice:confirmed to all players
    this.server.to(roomCode).emit('dice:confirmed', { playerId });

    // Also broadcast the updated game state
    this.server.to(roomCode).emit('game:stateUpdate', { gameState });
  }

  handleConnection(client: TypedSocket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: TypedSocket): Promise<void> {
    this.logger.log(`Client disconnected: ${client.id}`);

    const { playerId, roomCode } = client.data;
    if (playerId && roomCode) {
      // Mark player as disconnected but keep in room for potential reconnection
      await this.roomService.markPlayerDisconnected(roomCode, playerId);

      // Notify other players in the room
      client.to(roomCode).emit('player:disconnected', { playerId });
    }
  }

  @SubscribeMessage('room:create')
  async handleRoomCreate(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: CreateRoomDto,
  ): Promise<void> {
    try {
      const result = await this.roomService.createRoom(
        client.id,
        data.playerName,
        data.config || {},
      );

      // Set socket data
      client.data.playerId = result.playerId;
      client.data.roomCode = result.roomCode;
      client.data.reconnectToken = result.reconnectToken;

      // Join the socket room
      void client.join(result.roomCode);

      // Emit success event
      client.emit('room:created', {
        roomCode: result.roomCode,
        playerId: result.playerId,
        reconnectToken: result.reconnectToken,
        gameState: result.gameState,
      });
    } catch (error) {
      this.logger.error('Error creating room:', error);
      if (error instanceof RoomError) {
        client.emit('room:error', { message: error.message, code: error.code });
      } else {
        client.emit('room:error', {
          message: 'Failed to create room',
          code: 'CREATE_FAILED',
        });
      }
    }
  }

  @SubscribeMessage('room:join')
  async handleRoomJoin(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: JoinRoomDto,
  ): Promise<void> {
    try {
      const result = await this.roomService.joinRoom(
        data.roomCode.toUpperCase(),
        client.id,
        data.playerName,
      );

      // Set socket data
      client.data.playerId = result.playerId;
      client.data.roomCode = data.roomCode.toUpperCase();
      client.data.reconnectToken = result.reconnectToken;

      // Join the socket room
      void client.join(data.roomCode.toUpperCase());

      // Notify existing players
      client.to(data.roomCode.toUpperCase()).emit('room:playerJoined', {
        player: result.newPlayer,
      });

      // Emit success to joining player
      client.emit('room:joined', {
        playerId: result.playerId,
        reconnectToken: result.reconnectToken,
        gameState: result.gameState,
      });
    } catch (error) {
      this.logger.error('Error joining room:', error);
      if (error instanceof RoomError) {
        client.emit('room:error', { message: error.message, code: error.code });
      } else {
        client.emit('room:error', {
          message: 'Failed to join room',
          code: 'JOIN_FAILED',
        });
      }
    }
  }

  @SubscribeMessage('room:leave')
  async handleRoomLeave(@ConnectedSocket() client: TypedSocket): Promise<void> {
    const { playerId, roomCode } = client.data;

    if (!playerId || !roomCode) {
      return;
    }

    try {
      const { newHostId, roomDeleted } = await this.roomService.leaveRoom(
        roomCode,
        playerId,
      );

      // Leave the socket room
      void client.leave(roomCode);

      // Clear socket data
      client.data.playerId = undefined;
      client.data.roomCode = undefined;
      client.data.reconnectToken = undefined;

      if (roomDeleted) {
        return;
      }

      // Notify remaining players about the player leaving
      this.server.to(roomCode).emit('room:playerLeft', { playerId });

      // If host changed, notify about that too
      if (newHostId) {
        this.server.to(roomCode).emit('room:hostChanged', { newHostId });
      }
    } catch (error) {
      this.logger.error('Error leaving room:', error);
    }
  }

  @SubscribeMessage('room:reconnect')
  async handleRoomReconnect(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: { token: string },
  ): Promise<void> {
    try {
      const tokenData = await this.redisService.getReconnectToken(data.token);

      if (!tokenData || tokenData.expiresAt < Date.now()) {
        client.emit('reconnect:failed', {
          message: 'Invalid or expired reconnect token',
        });
        return;
      }

      const { playerId, roomCode } = tokenData;

      const gameState = await this.roomService.markPlayerReconnected(
        roomCode,
        playerId,
        client.id,
      );

      if (!gameState) {
        client.emit('reconnect:failed', { message: 'Room no longer exists' });
        return;
      }

      const player = gameState.players.find((p) => p.id === playerId);
      if (!player) {
        client.emit('reconnect:failed', {
          message: 'Player no longer in room',
        });
        return;
      }

      // Set socket data
      client.data.playerId = playerId;
      client.data.roomCode = roomCode;
      client.data.reconnectToken = data.token;

      // Join the socket room
      void client.join(roomCode);

      // Notify other players
      client.to(roomCode).emit('player:reconnected', { playerId });

      // Send current game state to reconnected player (include playerId for client store)
      client.emit('reconnect:success', { gameState, playerId });

      this.logger.log(`Player ${playerId} reconnected to room: ${roomCode}`);
    } catch (error) {
      this.logger.error('Error during reconnection:', error);
      client.emit('reconnect:failed', { message: 'Reconnection failed' });
    }
  }

  @SubscribeMessage('game:ready')
  async handleGameReady(@ConnectedSocket() client: TypedSocket): Promise<void> {
    const { playerId, roomCode } = client.data;

    if (!playerId || !roomCode) {
      client.emit('room:error', {
        message: 'Not in a room',
        code: 'NOT_IN_ROOM',
      });
      return;
    }

    try {
      const gameState = await this.roomService.setPlayerReady(
        roomCode,
        playerId,
        true,
      );

      // Broadcast updated state to all players in the room
      this.server.to(roomCode).emit('game:stateUpdate', { gameState });
    } catch (error) {
      this.logger.error('Error setting player ready:', error);
      if (error instanceof RoomError) {
        client.emit('room:error', { message: error.message, code: error.code });
      } else {
        client.emit('room:error', {
          message: 'Failed to set ready state',
          code: 'READY_FAILED',
        });
      }
    }
  }

  @SubscribeMessage('game:unready')
  async handleGameUnready(
    @ConnectedSocket() client: TypedSocket,
  ): Promise<void> {
    const { playerId, roomCode } = client.data;

    if (!playerId || !roomCode) {
      client.emit('room:error', {
        message: 'Not in a room',
        code: 'NOT_IN_ROOM',
      });
      return;
    }

    try {
      const gameState = await this.roomService.setPlayerReady(
        roomCode,
        playerId,
        false,
      );

      // Broadcast updated state to all players in the room
      this.server.to(roomCode).emit('game:stateUpdate', { gameState });
    } catch (error) {
      this.logger.error('Error setting player unready:', error);
      if (error instanceof RoomError) {
        client.emit('room:error', { message: error.message, code: error.code });
      } else {
        client.emit('room:error', {
          message: 'Failed to set ready state',
          code: 'UNREADY_FAILED',
        });
      }
    }
  }

  @SubscribeMessage('game:updateConfig')
  async handleUpdateConfig(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: UpdateConfigDto,
  ): Promise<void> {
    const { playerId, roomCode } = client.data;

    if (!playerId || !roomCode) {
      client.emit('room:error', {
        message: 'Not in a room',
        code: 'NOT_IN_ROOM',
      });
      return;
    }

    try {
      const gameState = await this.roomService.updateConfig(
        roomCode,
        playerId,
        data,
      );

      // Broadcast config update to all players
      this.server
        .to(roomCode)
        .emit('room:configUpdated', { config: gameState.config });
    } catch (error) {
      this.logger.error('Error updating config:', error);
      if (error instanceof RoomError) {
        client.emit('room:error', { message: error.message, code: error.code });
      } else {
        client.emit('room:error', {
          message: 'Failed to update config',
          code: 'UPDATE_CONFIG_FAILED',
        });
      }
    }
  }

  @SubscribeMessage('game:start')
  async handleGameStart(@ConnectedSocket() client: TypedSocket): Promise<void> {
    const { playerId, roomCode } = client.data;

    if (!playerId || !roomCode) {
      client.emit('room:error', {
        message: 'Not in a room',
        code: 'NOT_IN_ROOM',
      });
      return;
    }

    try {
      // Use GameService to start the game (which manages the state machine)
      const gameState = await this.gameService.startGame(roomCode, playerId);

      this.logger.log(`Game started in room ${roomCode}`);

      // The state change handler will broadcast phase changes automatically
      // But we also send an initial state update
      this.server.to(roomCode).emit('game:stateUpdate', { gameState });
    } catch (error) {
      this.logger.error('Error starting game:', error);
      if (error instanceof RoomError) {
        client.emit('room:error', { message: error.message, code: error.code });
      } else if (error instanceof GameError) {
        client.emit('room:error', { message: error.message, code: error.code });
      } else {
        client.emit('room:error', {
          message: 'Failed to start game',
          code: 'START_FAILED',
        });
      }
    }
  }

  // ==================== GAME EVENT HANDLERS ====================

  @SubscribeMessage('prediction:submit')
  async handlePredictionSubmit(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: { type: PredictionType },
  ): Promise<void> {
    const { playerId, roomCode } = client.data;

    if (!playerId || !roomCode) {
      client.emit('room:error', {
        message: 'Not in a room',
        code: 'NOT_IN_ROOM',
      });
      return;
    }

    try {
      const gameState = await this.gameService.submitPrediction(
        roomCode,
        playerId,
        data.type,
      );

      // Notify all players that this player submitted a prediction
      this.server.to(roomCode).emit('prediction:submitted', { playerId });

      // Check if all players have submitted
      const allSubmitted = gameState.players.every((p) => p.prediction !== null);
      if (allSubmitted) {
        this.server.to(roomCode).emit('prediction:allSubmitted');
      }

      this.logger.log(
        `Player ${playerId} submitted prediction ${data.type} in room ${roomCode}`,
      );
    } catch (error) {
      this.logger.error('Error submitting prediction:', error);
      if (error instanceof GameError) {
        client.emit('room:error', { message: error.message, code: error.code });
      } else {
        client.emit('room:error', {
          message: 'Failed to submit prediction',
          code: 'PREDICTION_FAILED',
        });
      }
    }
  }

  @SubscribeMessage('dice:select')
  async handleDiceSelect(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: { dieIds: string[] },
  ): Promise<void> {
    const { playerId, roomCode } = client.data;

    if (!playerId || !roomCode) {
      client.emit('room:error', {
        message: 'Not in a room',
        code: 'NOT_IN_ROOM',
      });
      return;
    }

    try {
      const gameState = await this.gameService.selectDice(
        roomCode,
        playerId,
        data.dieIds,
      );

      // Find the player to get their dice info
      const player = gameState.players.find((p) => p.id === playerId);
      if (player) {
        // Get the selected dice
        const selectedDice = data.dieIds
          .map((id) => player.dice.find((d) => d.id === id))
          .filter((d) => d !== undefined);

        // Only show visible (white) dice to opponents
        const visibleDice = selectedDice.filter((d) => d!.isRevealed);
        const hiddenCount = selectedDice.length - visibleDice.length;

        // Broadcast to all players in the room
        this.server.to(roomCode).emit('dice:selected', {
          playerId,
          visibleDice: visibleDice as import('@devilsdice/shared').Die[],
          hiddenCount,
        });
      }

      this.logger.log(`Player ${playerId} selected dice in room ${roomCode}`);
    } catch (error) {
      this.logger.error('Error selecting dice:', error);
      if (error instanceof GameError) {
        client.emit('room:error', { message: error.message, code: error.code });
      } else {
        client.emit('room:error', {
          message: 'Failed to select dice',
          code: 'SELECT_FAILED',
        });
      }
    }
  }

  @SubscribeMessage('dice:confirm')
  async handleDiceConfirm(
    @ConnectedSocket() client: TypedSocket,
  ): Promise<void> {
    const { playerId, roomCode } = client.data;

    if (!playerId || !roomCode) {
      client.emit('room:error', {
        message: 'Not in a room',
        code: 'NOT_IN_ROOM',
      });
      return;
    }

    try {
      const gameState = await this.gameService.confirmSelection(
        roomCode,
        playerId,
      );

      // Notify all players that this player confirmed
      this.server.to(roomCode).emit('dice:confirmed', { playerId });

      // Check if all players have confirmed - if so, the state machine
      // will transition to SET_REVEAL and the state change handler will broadcast

      // If there are more players to select, emit turn start for next player
      const allConfirmed = gameState.players.every((p) => {
        const confirmed = gameState.pendingSelections[`${p.id}:confirmed`];
        return confirmed !== undefined;
      });

      if (!allConfirmed) {
        // Find next player who hasn't confirmed
        for (
          let i = gameState.currentTurnIndex;
          i < gameState.turnOrder.length;
          i++
        ) {
          const nextPlayerId = gameState.turnOrder[i];
          const confirmed = gameState.pendingSelections[`${nextPlayerId}:confirmed`];
          if (!confirmed) {
            this.server.to(roomCode).emit('game:turnStart', {
              playerId: nextPlayerId,
              timeRemaining: gameState.config.turnTimerSeconds,
            });
            break;
          }
        }
      }

      this.logger.log(`Player ${playerId} confirmed selection in room ${roomCode}`);
    } catch (error) {
      this.logger.error('Error confirming selection:', error);
      if (error instanceof GameError) {
        client.emit('room:error', { message: error.message, code: error.code });
      } else {
        client.emit('room:error', {
          message: 'Failed to confirm selection',
          code: 'CONFIRM_FAILED',
        });
      }
    }
  }

  // ==================== PHASE ADVANCEMENT HANDLERS ====================

  /**
   * Advance to next set after set reveal (called by client or auto-advance)
   */
  async advanceToNextSet(roomCode: string): Promise<void> {
    try {
      const gameState = await this.gameService.advanceToNextSet(roomCode);
      this.server.to(roomCode).emit('game:stateUpdate', { gameState });
    } catch (error) {
      this.logger.error(`Error advancing to next set in room ${roomCode}:`, error);
    }
  }

  /**
   * Advance to next round after round summary (called by client or auto-advance)
   */
  async advanceToNextRound(roomCode: string): Promise<void> {
    try {
      const gameState = await this.gameService.advanceToNextRound(roomCode);
      this.server.to(roomCode).emit('game:stateUpdate', { gameState });
    } catch (error) {
      this.logger.error(`Error advancing to next round in room ${roomCode}:`, error);
    }
  }

  // ==================== AUTO-ADVANCE AFTER RESULTS ====================

  /**
   * Clears acknowledgement tracking for a room
   */
  private clearResultsAcknowledgements(roomCode: string): void {
    this.resultsAcknowledgements.delete(roomCode);
    const timeout = this.resultsTimeouts.get(roomCode);
    if (timeout) {
      clearTimeout(timeout);
      this.resultsTimeouts.delete(roomCode);
    }
  }

  /**
   * Starts the timeout for auto-advancing results
   */
  private startResultsTimeout(roomCode: string): void {
    // Clear any existing timeout
    const existingTimeout = this.resultsTimeouts.get(roomCode);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      this.logger.log(`Results timeout reached for room ${roomCode}, auto-advancing`);
      await this.forceAdvanceResults(roomCode);
    }, this.RESULTS_TIMEOUT_MS);

    this.resultsTimeouts.set(roomCode, timeout);
  }

  /**
   * Forces advancement regardless of acknowledgements (called on timeout)
   */
  private async forceAdvanceResults(roomCode: string): Promise<void> {
    try {
      const gameState = await this.gameService.getGameState(roomCode);
      if (!gameState) return;

      this.clearResultsAcknowledgements(roomCode);

      if (gameState.phase === GamePhase.SET_REVEAL) {
        await this.advanceToNextSet(roomCode);
      } else if (gameState.phase === GamePhase.ROUND_SUMMARY) {
        await this.advanceToNextRound(roomCode);
      }
    } catch (error) {
      this.logger.error(`Error force advancing results for room ${roomCode}:`, error);
    }
  }

  /**
   * Called when a player acknowledges the results
   * Auto-advances after all players acknowledge or after timeout
   */
  @SubscribeMessage('game:acknowledgeResults')
  async handleAcknowledgeResults(
    @ConnectedSocket() client: TypedSocket,
  ): Promise<void> {
    const { roomCode, playerId } = client.data;

    if (!roomCode || !playerId) {
      return;
    }

    try {
      const gameState = await this.gameService.getGameState(roomCode);
      if (!gameState) return;

      // Only track acknowledgements during results phases
      if (gameState.phase !== GamePhase.SET_REVEAL && gameState.phase !== GamePhase.ROUND_SUMMARY) {
        return;
      }

      // Initialize acknowledgement set for this room if needed
      if (!this.resultsAcknowledgements.has(roomCode)) {
        this.resultsAcknowledgements.set(roomCode, new Set());
        // Start the timeout when first acknowledgement comes in
        this.startResultsTimeout(roomCode);
      }

      const acks = this.resultsAcknowledgements.get(roomCode)!;
      acks.add(playerId);

      // Get connected players
      const connectedPlayerIds = gameState.players
        .filter(p => p.isConnected)
        .map(p => p.id);

      // Notify all players of the acknowledgement
      this.server.to(roomCode).emit('results:acknowledged', {
        playerId,
        acknowledgedCount: acks.size,
        totalCount: connectedPlayerIds.length,
      });

      // Calculate who we're still waiting for
      const waitingForPlayerIds = connectedPlayerIds.filter(id => !acks.has(id));

      // Notify about who we're waiting for
      this.server.to(roomCode).emit('results:waitingFor', {
        waitingForPlayerIds,
      });

      this.logger.log(`Room ${roomCode}: ${acks.size}/${connectedPlayerIds.length} players acknowledged results`);

      // Check if all connected players have acknowledged
      if (acks.size >= connectedPlayerIds.length) {
        this.logger.log(`All players acknowledged results in room ${roomCode}, advancing`);
        this.clearResultsAcknowledgements(roomCode);

        // Auto-advance based on current phase
        if (gameState.phase === GamePhase.SET_REVEAL) {
          await this.advanceToNextSet(roomCode);
        } else if (gameState.phase === GamePhase.ROUND_SUMMARY) {
          await this.advanceToNextRound(roomCode);
        }
      }
    } catch (error) {
      this.logger.error('Error acknowledging results:', error);
    }
  }
}
