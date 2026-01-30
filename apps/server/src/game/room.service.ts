import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  GameState,
  GamePhase,
  GameConfig,
  Player,
  DEFAULT_GAME_CONFIG,
  GAME_LIMITS,
  ReconnectToken,
} from '@devilsdice/shared';
import { RedisService } from '../redis/redis.service';

export interface RoomCreateResult {
  roomCode: string;
  playerId: string;
  reconnectToken: string;
  gameState: GameState;
}

export interface RoomJoinResult {
  playerId: string;
  reconnectToken: string;
  gameState: GameState;
  newPlayer: Player;
}

export class RoomError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RoomError';
  }
}

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);

  // Characters that avoid confusion (no 0/O, 1/I/L)
  private readonly ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  constructor(private readonly redisService: RedisService) {}

  /**
   * Generate a 6-character room code using unambiguous characters
   */
  generateRoomCode(): string {
    let code = '';
    for (let i = 0; i < GAME_LIMITS.ROOM_CODE_LENGTH; i++) {
      const randomIndex = Math.floor(
        Math.random() * this.ROOM_CODE_CHARS.length,
      );
      code += this.ROOM_CODE_CHARS[randomIndex];
    }
    return code;
  }

  /**
   * Generate a reconnect token using UUID
   */
  generateReconnectToken(): string {
    return uuidv4();
  }

  /**
   * Create a new game room
   */
  async createRoom(
    hostSocketId: string,
    playerName: string,
    config: Partial<GameConfig> = {},
  ): Promise<RoomCreateResult> {
    const roomCode = this.generateRoomCode();
    const playerId = uuidv4();
    const reconnectToken = this.generateReconnectToken();

    // Merge provided config with defaults
    const gameConfig: GameConfig = {
      ...DEFAULT_GAME_CONFIG,
      ...config,
    };

    // Create the host player
    const hostPlayer: Player = {
      id: playerId,
      name: playerName,
      socketId: hostSocketId,
      dice: [],
      cumulativeScore: 0,
      currentRoundScore: 0,
      set1Score: 0,
      set2Score: 0,
      prediction: null,
      isConnected: true,
      isReady: false,
      isHost: true,
    };

    // Create initial game state
    const gameState: GameState = {
      roomCode,
      phase: GamePhase.LOBBY,
      players: [hostPlayer],
      config: gameConfig,
      currentRound: 0,
      currentSet: 1,
      turnOrder: [],
      currentTurnIndex: 0,
      pendingSelections: {},
      setResults: [],
      roundHistory: [],
      initialRollResults: [],
      hostId: playerId,
      createdAt: Date.now(),
    };

    // Store game state in Redis
    await this.redisService.setGameState(roomCode, gameState);

    // Store reconnect token
    const tokenData: ReconnectToken = {
      token: reconnectToken,
      playerId,
      roomCode,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };
    await this.redisService.setReconnectToken(reconnectToken, tokenData);

    this.logger.log(`Room created: ${roomCode} by player: ${playerName}`);

    return {
      roomCode,
      playerId,
      reconnectToken,
      gameState,
    };
  }

  /**
   * Join an existing room
   */
  async joinRoom(
    roomCode: string,
    socketId: string,
    playerName: string,
  ): Promise<RoomJoinResult> {
    const gameState = await this.redisService.getGameState(roomCode);

    if (!gameState) {
      throw new RoomError('ROOM_NOT_FOUND', 'Room not found');
    }

    if (gameState.phase !== GamePhase.LOBBY) {
      throw new RoomError('GAME_IN_PROGRESS', 'Game already in progress');
    }

    if (gameState.players.length >= gameState.config.maxPlayers) {
      throw new RoomError('ROOM_FULL', 'Room is full');
    }

    // Check for duplicate names (case-insensitive)
    if (
      gameState.players.some(
        (p) => p.name.toLowerCase() === playerName.toLowerCase(),
      )
    ) {
      throw new RoomError('NAME_TAKEN', 'Name already taken');
    }

    const playerId = uuidv4();
    const reconnectToken = this.generateReconnectToken();

    // Create new player
    const newPlayer: Player = {
      id: playerId,
      name: playerName,
      socketId,
      dice: [],
      cumulativeScore: 0,
      currentRoundScore: 0,
      set1Score: 0,
      set2Score: 0,
      prediction: null,
      isConnected: true,
      isReady: false,
      isHost: false,
    };

    // Add player to game state
    gameState.players.push(newPlayer);

    // Store updated game state
    await this.redisService.setGameState(roomCode, gameState);

    // Store reconnect token
    const tokenData: ReconnectToken = {
      token: reconnectToken,
      playerId,
      roomCode,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
    await this.redisService.setReconnectToken(reconnectToken, tokenData);

    this.logger.log(`Player ${playerName} joined room: ${roomCode}`);

    return {
      playerId,
      reconnectToken,
      gameState,
      newPlayer,
    };
  }

  /**
   * Remove a player from a room
   * Returns the updated game state and whether a new host was assigned
   */
  async leaveRoom(
    roomCode: string,
    playerId: string,
  ): Promise<{
    gameState: GameState | null;
    newHostId: string | null;
    roomDeleted: boolean;
  }> {
    const gameState = await this.redisService.getGameState(roomCode);

    if (!gameState) {
      return { gameState: null, newHostId: null, roomDeleted: false };
    }

    const playerIndex = gameState.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) {
      return { gameState, newHostId: null, roomDeleted: false };
    }

    const leavingPlayer = gameState.players[playerIndex];
    gameState.players.splice(playerIndex, 1);

    // If no players left, delete the room
    if (gameState.players.length === 0) {
      await this.redisService.deleteGameState(roomCode);
      this.logger.log(`Room ${roomCode} deleted (no players left)`);
      return { gameState: null, newHostId: null, roomDeleted: true };
    }

    let newHostId: string | null = null;

    // If the leaving player was the host, assign a new host
    if (leavingPlayer.isHost && gameState.players.length > 0) {
      gameState.players[0].isHost = true;
      gameState.hostId = gameState.players[0].id;
      newHostId = gameState.hostId;
      this.logger.log(`New host assigned in room ${roomCode}: ${newHostId}`);
    }

    // Update game state
    await this.redisService.setGameState(roomCode, gameState);

    this.logger.log(`Player ${playerId} left room: ${roomCode}`);

    return { gameState, newHostId, roomDeleted: false };
  }

  /**
   * Get room/game state
   */
  async getRoom(roomCode: string): Promise<GameState | null> {
    return this.redisService.getGameState(roomCode);
  }

  /**
   * Update game configuration (host only)
   */
  async updateConfig(
    roomCode: string,
    playerId: string,
    config: Partial<GameConfig>,
  ): Promise<GameState> {
    const gameState = await this.redisService.getGameState(roomCode);

    if (!gameState) {
      throw new RoomError('ROOM_NOT_FOUND', 'Room not found');
    }

    if (gameState.hostId !== playerId) {
      throw new RoomError('NOT_HOST', 'Only the host can update configuration');
    }

    if (gameState.phase !== GamePhase.LOBBY) {
      throw new RoomError(
        'GAME_IN_PROGRESS',
        'Cannot change config after game starts',
      );
    }

    // Update config with provided values
    gameState.config = {
      ...gameState.config,
      ...config,
    };

    await this.redisService.setGameState(roomCode, gameState);

    this.logger.log(`Room ${roomCode} config updated by host`);

    return gameState;
  }

  /**
   * Set player ready state
   */
  async setPlayerReady(
    roomCode: string,
    playerId: string,
    ready: boolean,
  ): Promise<GameState> {
    const gameState = await this.redisService.getGameState(roomCode);

    if (!gameState) {
      throw new RoomError('ROOM_NOT_FOUND', 'Room not found');
    }

    const player = gameState.players.find((p) => p.id === playerId);
    if (!player) {
      throw new RoomError('PLAYER_NOT_FOUND', 'Player not found in room');
    }

    if (gameState.phase !== GamePhase.LOBBY) {
      throw new RoomError(
        'GAME_IN_PROGRESS',
        'Cannot change ready state after game starts',
      );
    }

    player.isReady = ready;

    await this.redisService.setGameState(roomCode, gameState);

    this.logger.log(
      `Player ${playerId} ready state changed to ${ready} in room ${roomCode}`,
    );

    return gameState;
  }

  /**
   * Check if the game can start (all players ready and min 2 players)
   */
  async canStartGame(
    roomCode: string,
  ): Promise<{ canStart: boolean; reason?: string }> {
    const gameState = await this.redisService.getGameState(roomCode);

    if (!gameState) {
      return { canStart: false, reason: 'Room not found' };
    }

    if (gameState.phase !== GamePhase.LOBBY) {
      return { canStart: false, reason: 'Game already in progress' };
    }

    if (gameState.players.length < GAME_LIMITS.MIN_PLAYERS) {
      return {
        canStart: false,
        reason: `Need at least ${GAME_LIMITS.MIN_PLAYERS} players`,
      };
    }

    const allReady = gameState.players.every((p) => p.isReady || p.isHost);
    if (!allReady) {
      return { canStart: false, reason: 'Not all players are ready' };
    }

    return { canStart: true };
  }

  /**
   * Start the game by transitioning from LOBBY to INITIAL_ROLL phase
   */
  async startGame(roomCode: string, playerId: string): Promise<GameState> {
    const gameState = await this.redisService.getGameState(roomCode);

    if (!gameState) {
      throw new RoomError('ROOM_NOT_FOUND', 'Room not found');
    }

    if (gameState.hostId !== playerId) {
      throw new RoomError('NOT_HOST', 'Only the host can start the game');
    }

    const { canStart, reason } = await this.canStartGame(roomCode);
    if (!canStart) {
      throw new RoomError('CANNOT_START', reason || 'Cannot start game');
    }

    // Transition to INITIAL_ROLL phase
    gameState.phase = GamePhase.INITIAL_ROLL;
    gameState.currentRound = 1;

    await this.redisService.setGameState(roomCode, gameState);

    this.logger.log(`Game started in room ${roomCode}`);

    return gameState;
  }

  /**
   * Mark player as disconnected (but keep in room for reconnection)
   */
  async markPlayerDisconnected(
    roomCode: string,
    playerId: string,
  ): Promise<GameState | null> {
    const gameState = await this.redisService.getGameState(roomCode);

    if (!gameState) {
      return null;
    }

    const player = gameState.players.find((p) => p.id === playerId);
    if (player) {
      player.isConnected = false;
      await this.redisService.setGameState(roomCode, gameState);
    }

    return gameState;
  }

  /**
   * Mark player as reconnected and update socket ID
   */
  async markPlayerReconnected(
    roomCode: string,
    playerId: string,
    newSocketId: string,
  ): Promise<GameState | null> {
    const gameState = await this.redisService.getGameState(roomCode);

    if (!gameState) {
      return null;
    }

    const player = gameState.players.find((p) => p.id === playerId);
    if (player) {
      player.isConnected = true;
      player.socketId = newSocketId;
      await this.redisService.setGameState(roomCode, gameState);
    }

    return gameState;
  }
}
