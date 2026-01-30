import { Die, PredictionType } from './game.types';

export interface Player {
  id: string;
  name: string;
  socketId: string;
  dice: Die[];
  cumulativeScore: number;
  currentRoundScore: number;
  set1Score: number;
  set2Score: number;
  prediction: PredictionType | null;
  isConnected: boolean;
  isReady: boolean;
  isHost: boolean;
}

export interface PlayerPublicInfo {
  id: string;
  name: string;
  cumulativeScore: number;
  currentRoundScore: number;
  set1Score: number;
  set2Score: number;
  predictionSubmitted: boolean;
  isConnected: boolean;
  isReady: boolean;
  isHost: boolean;
}

export interface ReconnectToken {
  token: string;
  playerId: string;
  roomCode: string;
  expiresAt: number;
}
