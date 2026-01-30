import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  GameState,
  GamePhase,
  Player,
  Die,
  SetResult,
  RoundResult,
  GameConfig,
  PredictionType,
} from '@devilsdice/shared';

// Connection state
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// Room state for lobby
interface RoomState {
  roomCode: string | null;
  isHost: boolean;
  players: Player[];
  config: GameConfig | null;
}

// Game state during play
interface ActiveGameState {
  phase: GamePhase;
  currentRound: number;
  currentSet: 1 | 2;
  turnOrder: string[];
  currentTurnIndex: number;
  currentTurnPlayerId: string | null;
  myDice: Die[];
  visibleOpponentDice: Map<string, Die[]>;
  selectedDiceIds: string[];
  pendingSelections: Record<string, string[]>;
  confirmedPlayers: Set<string>;
  setResults: SetResult[];
  roundHistory: RoundResult[];
  timeRemaining: number;
  initialRollResults: { playerId: string; roll: number }[];
}

// Player-specific state
interface PlayerState {
  playerId: string | null;
  playerName: string | null;
  isReady: boolean;
  hasSubmittedPrediction: boolean;
  hasConfirmedSelection: boolean;
  myPrediction: PredictionType | null;
}

// UI state
interface UIState {
  error: string | null;
  isLoading: boolean;
  showResultsModal: boolean;
  resultsModalType: 'set' | 'round' | 'game';
  hasAcknowledgedResults: boolean;
  waitingForPlayerIds: string[];
  acknowledgedCount: number;
  totalPlayersCount: number;
}

// Combined store state
interface GameStoreState {
  // Connection
  connectionStatus: ConnectionStatus;

  // Room
  room: RoomState;

  // Game
  game: ActiveGameState | null;

  // Player
  player: PlayerState;

  // UI
  ui: UIState;

  // Actions - Connection
  setConnectionStatus: (status: ConnectionStatus) => void;

  // Actions - Room
  setRoomCode: (code: string | null) => void;
  setIsHost: (isHost: boolean) => void;
  setHostId: (hostId: string) => void;
  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  updatePlayerReady: (playerId: string, isReady: boolean) => void;
  updatePlayerConnection: (playerId: string, isConnected: boolean) => void;
  setRoomConfig: (config: GameConfig) => void;

  // Actions - Game
  setGameState: (gameState: GameState, overridePlayerId?: string) => void;
  setPhase: (phase: GamePhase) => void;
  setMyDice: (dice: Die[]) => void;
  setSelectedDice: (diceIds: string[]) => void;
  toggleDieSelection: (dieId: string) => void;
  setTimeRemaining: (time: number) => void;
  setSetResults: (results: SetResult[]) => void;
  addRoundResult: (result: RoundResult) => void;
  setCurrentTurnPlayer: (playerId: string) => void;
  setInitialRollResults: (results: { playerId: string; roll: number }[]) => void;
  setOpponentVisibleDice: (playerId: string, dice: Die[]) => void;
  markPlayerConfirmed: (playerId: string) => void;
  clearConfirmedPlayers: () => void;

  // Actions - Player
  setPlayerId: (id: string | null) => void;
  setPlayerName: (name: string | null) => void;
  setIsReady: (ready: boolean) => void;
  setHasSubmittedPrediction: (submitted: boolean) => void;
  setHasConfirmedSelection: (confirmed: boolean) => void;
  setMyPrediction: (prediction: PredictionType | null) => void;

  // Actions - UI
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setShowResultsModal: (show: boolean) => void;
  setResultsModalType: (type: 'set' | 'round' | 'game') => void;
  setHasAcknowledgedResults: (acknowledged: boolean) => void;
  setWaitingForPlayerIds: (playerIds: string[]) => void;
  setAcknowledgementProgress: (acknowledged: number, total: number) => void;
  resetResultsAcknowledgement: () => void;

  // Actions - Reset
  resetRoom: () => void;
  resetGame: () => void;
  resetAll: () => void;
  resetForNewRound: () => void;
  resetForNewSet: () => void;
}

const initialRoomState: RoomState = {
  roomCode: null,
  isHost: false,
  players: [],
  config: null,
};

const initialPlayerState: PlayerState = {
  playerId: null,
  playerName: null,
  isReady: false,
  hasSubmittedPrediction: false,
  hasConfirmedSelection: false,
  myPrediction: null,
};

const initialUIState: UIState = {
  error: null,
  isLoading: false,
  showResultsModal: false,
  resultsModalType: 'set',
  hasAcknowledgedResults: false,
  waitingForPlayerIds: [],
  acknowledgedCount: 0,
  totalPlayersCount: 0,
};

export const useGameStore = create<GameStoreState>()(
  devtools(
    (set) => ({
      // Initial state
      connectionStatus: 'disconnected',
      room: initialRoomState,
      game: null,
      player: initialPlayerState,
      ui: initialUIState,

      // Connection actions
      setConnectionStatus: (status) =>
        set({ connectionStatus: status }, undefined, 'setConnectionStatus'),

      // Room actions
      setRoomCode: (code) =>
        set(
          (state) => ({ room: { ...state.room, roomCode: code } }),
          undefined,
          'setRoomCode'
        ),

      setIsHost: (isHost) =>
        set(
          (state) => ({ room: { ...state.room, isHost } }),
          undefined,
          'setIsHost'
        ),

      setHostId: (hostId) =>
        set(
          (state) => ({
            room: {
              ...state.room,
              isHost: hostId === state.player.playerId,
              players: state.room.players.map((p) => ({
                ...p,
                isHost: p.id === hostId,
              })),
            },
          }),
          undefined,
          'setHostId'
        ),

      setPlayers: (players) =>
        set(
          (state) => ({ room: { ...state.room, players } }),
          undefined,
          'setPlayers'
        ),

      addPlayer: (player) =>
        set(
          (state) => ({
            room: { ...state.room, players: [...state.room.players, player] },
          }),
          undefined,
          'addPlayer'
        ),

      removePlayer: (playerId) =>
        set(
          (state) => ({
            room: {
              ...state.room,
              players: state.room.players.filter((p) => p.id !== playerId),
            },
          }),
          undefined,
          'removePlayer'
        ),

      updatePlayerReady: (playerId, isReady) =>
        set(
          (state) => ({
            room: {
              ...state.room,
              players: state.room.players.map((p) =>
                p.id === playerId ? { ...p, isReady } : p
              ),
            },
          }),
          undefined,
          'updatePlayerReady'
        ),

      updatePlayerConnection: (playerId, isConnected) =>
        set(
          (state) => ({
            room: {
              ...state.room,
              players: state.room.players.map((p) =>
                p.id === playerId ? { ...p, isConnected } : p
              ),
            },
          }),
          undefined,
          'updatePlayerConnection'
        ),

      setRoomConfig: (config) =>
        set(
          (state) => ({ room: { ...state.room, config } }),
          undefined,
          'setRoomConfig'
        ),

      // Game actions
      setGameState: (gameState, overridePlayerId) =>
        set(
          (state) => {
            // Use overridePlayerId if provided, otherwise fall back to state
            const playerId = overridePlayerId ?? state.player.playerId;
            const myPlayer = gameState.players.find(
              (p) => p.id === playerId
            );
            const currentTurnPlayerId = gameState.turnOrder[gameState.currentTurnIndex] || null;

            // Preserve existing visibleOpponentDice if we have them
            const existingOpponentDice = state.game?.visibleOpponentDice || new Map();

            return {
              room: {
                ...state.room,
                roomCode: gameState.roomCode,
                players: gameState.players,
                config: gameState.config,
                isHost: gameState.hostId === state.player.playerId,
              },
              player: {
                ...state.player,
                isReady: myPlayer?.isReady ?? state.player.isReady,
                hasSubmittedPrediction: myPlayer?.prediction !== null,
                myPrediction: myPlayer?.prediction ?? state.player.myPrediction,
              },
              game: {
                phase: gameState.phase,
                currentRound: gameState.currentRound,
                currentSet: gameState.currentSet,
                turnOrder: gameState.turnOrder,
                currentTurnIndex: gameState.currentTurnIndex,
                currentTurnPlayerId,
                myDice: myPlayer?.dice ?? [],
                visibleOpponentDice: existingOpponentDice,
                selectedDiceIds: state.game?.selectedDiceIds ?? [],
                pendingSelections: gameState.pendingSelections,
                confirmedPlayers: state.game?.confirmedPlayers ?? new Set(),
                setResults: gameState.setResults,
                roundHistory: gameState.roundHistory,
                timeRemaining: state.game?.timeRemaining ?? 0,
                initialRollResults: gameState.initialRollResults,
              },
            };
          },
          undefined,
          'setGameState'
        ),

      setPhase: (phase) =>
        set(
          (state) => ({
            game: state.game ? { ...state.game, phase } : null,
          }),
          undefined,
          'setPhase'
        ),

      setMyDice: (dice) =>
        set(
          (state) => ({
            game: state.game ? { ...state.game, myDice: dice } : null,
          }),
          undefined,
          'setMyDice'
        ),

      setSelectedDice: (diceIds) =>
        set(
          (state) => ({
            game: state.game ? { ...state.game, selectedDiceIds: diceIds } : null,
          }),
          undefined,
          'setSelectedDice'
        ),

      toggleDieSelection: (dieId) =>
        set(
          (state) => {
            if (!state.game) return {};
            const currentSelected = state.game.selectedDiceIds;
            const newSelected = currentSelected.includes(dieId)
              ? currentSelected.filter((id) => id !== dieId)
              : currentSelected.length < 3
              ? [...currentSelected, dieId]
              : currentSelected;
            return {
              game: { ...state.game, selectedDiceIds: newSelected },
            };
          },
          undefined,
          'toggleDieSelection'
        ),

      setTimeRemaining: (time) =>
        set(
          (state) => ({
            game: state.game ? { ...state.game, timeRemaining: time } : null,
          }),
          undefined,
          'setTimeRemaining'
        ),

      setSetResults: (results) =>
        set(
          (state) => ({
            game: state.game ? { ...state.game, setResults: results } : null,
          }),
          undefined,
          'setSetResults'
        ),

      addRoundResult: (result) =>
        set(
          (state) => ({
            game: state.game
              ? {
                  ...state.game,
                  roundHistory: [...state.game.roundHistory, result],
                }
              : null,
          }),
          undefined,
          'addRoundResult'
        ),

      setCurrentTurnPlayer: (playerId) =>
        set(
          (state) => ({
            game: state.game
              ? { ...state.game, currentTurnPlayerId: playerId }
              : null,
          }),
          undefined,
          'setCurrentTurnPlayer'
        ),

      setInitialRollResults: (results) =>
        set(
          (state) => ({
            game: state.game
              ? { ...state.game, initialRollResults: results }
              : null,
          }),
          undefined,
          'setInitialRollResults'
        ),

      setOpponentVisibleDice: (playerId, dice) =>
        set(
          (state) => {
            if (!state.game) return {};
            const newMap = new Map(state.game.visibleOpponentDice);
            newMap.set(playerId, dice);
            return {
              game: { ...state.game, visibleOpponentDice: newMap },
            };
          },
          undefined,
          'setOpponentVisibleDice'
        ),

      markPlayerConfirmed: (playerId) =>
        set(
          (state) => {
            if (!state.game) return {};
            const newSet = new Set(state.game.confirmedPlayers);
            newSet.add(playerId);
            return {
              game: { ...state.game, confirmedPlayers: newSet },
            };
          },
          undefined,
          'markPlayerConfirmed'
        ),

      clearConfirmedPlayers: () =>
        set(
          (state) => ({
            game: state.game
              ? { ...state.game, confirmedPlayers: new Set() }
              : null,
          }),
          undefined,
          'clearConfirmedPlayers'
        ),

      // Player actions
      setPlayerId: (id) =>
        set(
          (state) => ({ player: { ...state.player, playerId: id } }),
          undefined,
          'setPlayerId'
        ),

      setPlayerName: (name) =>
        set(
          (state) => ({ player: { ...state.player, playerName: name } }),
          undefined,
          'setPlayerName'
        ),

      setIsReady: (ready) =>
        set(
          (state) => ({ player: { ...state.player, isReady: ready } }),
          undefined,
          'setIsReady'
        ),

      setHasSubmittedPrediction: (submitted) =>
        set(
          (state) => ({
            player: { ...state.player, hasSubmittedPrediction: submitted },
          }),
          undefined,
          'setHasSubmittedPrediction'
        ),

      setHasConfirmedSelection: (confirmed) =>
        set(
          (state) => ({
            player: { ...state.player, hasConfirmedSelection: confirmed },
          }),
          undefined,
          'setHasConfirmedSelection'
        ),

      setMyPrediction: (prediction) =>
        set(
          (state) => ({
            player: { ...state.player, myPrediction: prediction },
          }),
          undefined,
          'setMyPrediction'
        ),

      // UI actions
      setError: (error) =>
        set((state) => ({ ui: { ...state.ui, error } }), undefined, 'setError'),

      setIsLoading: (loading) =>
        set(
          (state) => ({ ui: { ...state.ui, isLoading: loading } }),
          undefined,
          'setIsLoading'
        ),

      setShowResultsModal: (show) =>
        set(
          (state) => ({ ui: { ...state.ui, showResultsModal: show } }),
          undefined,
          'setShowResultsModal'
        ),

      setResultsModalType: (type) =>
        set(
          (state) => ({ ui: { ...state.ui, resultsModalType: type } }),
          undefined,
          'setResultsModalType'
        ),

      setHasAcknowledgedResults: (acknowledged) =>
        set(
          (state) => ({ ui: { ...state.ui, hasAcknowledgedResults: acknowledged } }),
          undefined,
          'setHasAcknowledgedResults'
        ),

      setWaitingForPlayerIds: (playerIds) =>
        set(
          (state) => ({ ui: { ...state.ui, waitingForPlayerIds: playerIds } }),
          undefined,
          'setWaitingForPlayerIds'
        ),

      setAcknowledgementProgress: (acknowledged, total) =>
        set(
          (state) => ({
            ui: { ...state.ui, acknowledgedCount: acknowledged, totalPlayersCount: total },
          }),
          undefined,
          'setAcknowledgementProgress'
        ),

      resetResultsAcknowledgement: () =>
        set(
          (state) => ({
            ui: {
              ...state.ui,
              hasAcknowledgedResults: false,
              waitingForPlayerIds: [],
              acknowledgedCount: 0,
              totalPlayersCount: 0,
            },
          }),
          undefined,
          'resetResultsAcknowledgement'
        ),

      // Reset actions
      resetRoom: () =>
        set({ room: initialRoomState }, undefined, 'resetRoom'),

      resetGame: () => set({ game: null }, undefined, 'resetGame'),

      resetAll: () =>
        set(
          {
            connectionStatus: 'disconnected',
            room: initialRoomState,
            game: null,
            player: initialPlayerState,
            ui: initialUIState,
          },
          undefined,
          'resetAll'
        ),

      resetForNewRound: () =>
        set(
          (state) => ({
            player: {
              ...state.player,
              hasSubmittedPrediction: false,
              hasConfirmedSelection: false,
              myPrediction: null,
            },
            game: state.game
              ? {
                  ...state.game,
                  selectedDiceIds: [],
                  confirmedPlayers: new Set(),
                  visibleOpponentDice: new Map(),
                }
              : null,
            ui: {
              ...state.ui,
              showResultsModal: false,
            },
          }),
          undefined,
          'resetForNewRound'
        ),

      resetForNewSet: () =>
        set(
          (state) => ({
            player: {
              ...state.player,
              hasConfirmedSelection: false,
            },
            game: state.game
              ? {
                  ...state.game,
                  selectedDiceIds: [],
                  confirmedPlayers: new Set(),
                }
              : null,
            ui: {
              ...state.ui,
              showResultsModal: false,
            },
          }),
          undefined,
          'resetForNewSet'
        ),
    }),
    { name: 'GameStore' }
  )
);
