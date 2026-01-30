import {
  Die,
  GameConfig,
  GamePhase,
  GameState,
  PredictionType,
  RoundResult,
  SetResult,
} from './game.types';
import { Player } from './player.types';

// Client → Server Events
export interface ClientToServerEvents {
  'room:create': (data: {
    playerName: string;
    config: Partial<GameConfig>;
  }) => void;
  'room:join': (data: { roomCode: string; playerName: string }) => void;
  'room:leave': () => void;
  'room:reconnect': (data: { token: string }) => void;

  'game:ready': () => void;
  'game:unready': () => void;
  'game:start': () => void;
  'game:updateConfig': (data: Partial<GameConfig>) => void;

  'prediction:submit': (data: { type: PredictionType }) => void;

  'dice:select': (data: { dieIds: string[] }) => void;
  'dice:confirm': () => void;

  'game:acknowledgeResults': () => void;
}

// Server → Client Events
export interface ServerToClientEvents {
  // Room events
  'room:created': (data: {
    roomCode: string;
    playerId: string;
    reconnectToken: string;
    gameState: GameState;
  }) => void;
  'room:joined': (data: {
    playerId: string;
    reconnectToken: string;
    gameState: GameState;
  }) => void;
  'room:playerJoined': (data: { player: Player }) => void;
  'room:playerLeft': (data: { playerId: string }) => void;
  'room:error': (data: { message: string; code?: string }) => void;
  'room:configUpdated': (data: { config: GameConfig }) => void;
  'room:hostChanged': (data: { newHostId: string }) => void;

  // Game state events
  'game:stateUpdate': (data: { gameState: GameState }) => void;
  'game:phaseChange': (data: { phase: GamePhase; gameState: GameState }) => void;
  'game:turnStart': (data: {
    playerId: string;
    timeRemaining: number;
  }) => void;
  'game:timerTick': (data: { timeRemaining: number }) => void;
  'game:initialRoll': (data: {
    results: { playerId: string; roll: number }[];
    turnOrder: string[];
  }) => void;

  // Prediction events
  'prediction:submitted': (data: { playerId: string }) => void;
  'prediction:allSubmitted': () => void;
  'prediction:autoSubmitting': (data: { countdown: number }) => void;

  // Dice events
  'dice:rolled': (data: { gameState: GameState }) => void;
  'dice:selected': (data: {
    playerId: string;
    visibleDice: Die[];
    hiddenCount: number;
  }) => void;
  'dice:confirmed': (data: { playerId: string }) => void;

  // Results events
  'set:reveal': (data: { results: SetResult[]; gameState: GameState }) => void;
  'round:complete': (data: {
    result: RoundResult;
    gameState: GameState;
  }) => void;
  'game:over': (data: {
    finalStandings: { playerId: string; name: string; score: number }[];
  }) => void;
  'results:acknowledged': (data: {
    playerId: string;
    acknowledgedCount: number;
    totalCount: number;
  }) => void;
  'results:waitingFor': (data: {
    waitingForPlayerIds: string[];
  }) => void;

  // Connection events
  'player:disconnected': (data: { playerId: string }) => void;
  'player:reconnected': (data: { playerId: string }) => void;
  'reconnect:success': (data: { gameState: GameState; playerId: string }) => void;
  'reconnect:failed': (data: { message: string }) => void;
}

// Combined type for Socket.IO typing
export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  playerId: string;
  roomCode: string;
  reconnectToken: string;
}
