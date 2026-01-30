import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { socketService } from '@/services/socket';
import { useGameStore } from '@/stores/gameStore';
import { ToastContainer, useToast, toast } from '@/components/ui';
import { ConnectionOverlay } from '@/components/ui';
import Home from '@/pages/Home';
import Lobby from '@/pages/Lobby';
import Game from '@/pages/Game';
import type { GameState, Player, GameConfig, GamePhase, Die, SetResult, RoundResult } from '@devilsdice/shared';
import { GamePhase as GamePhaseEnum } from '@devilsdice/shared';

// Socket event handler component
function SocketHandler() {
  const navigate = useNavigate();
  const {
    setConnectionStatus,
    setPlayerId,
    setRoomCode,
    setIsHost,
    setHostId,
    addPlayer,
    removePlayer,
    updatePlayerConnection,
    setRoomConfig,
    setGameState,
    setError,
    setIsLoading,
    setTimeRemaining,
    setSetResults,
    addRoundResult,
    setCurrentTurnPlayer,
    setInitialRollResults,
    setOpponentVisibleDice,
    markPlayerConfirmed,
    setHasSubmittedPrediction,
    setHasConfirmedSelection,
    setShowResultsModal,
    setResultsModalType,
    resetForNewRound,
    resetForNewSet,
    setWaitingForPlayerIds,
    setAcknowledgementProgress,
    resetResultsAcknowledgement,
  } = useGameStore();

  useEffect(() => {
    // Connect to socket
    const socket = socketService.connect();
    setConnectionStatus('connecting');

    // Connection events
    socket.on('connect', () => {
      setConnectionStatus('connected');
      setIsLoading(false);
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', () => {
      setConnectionStatus('disconnected');
      setError('Failed to connect to server');
      setIsLoading(false);
      toast.error('Failed to connect to server. Please check your connection.');
    });

    // Room events
    socket.on('room:created', (data: { roomCode: string; playerId: string; reconnectToken: string; gameState: GameState }) => {
      setPlayerId(data.playerId);
      setRoomCode(data.roomCode);
      setIsHost(true);
      setGameState(data.gameState, data.playerId);
      socketService.setReconnectToken(data.reconnectToken);
      socketService.setRoomCode(data.roomCode);
      setIsLoading(false);
      navigate(`/lobby/${data.roomCode}`);
    });

    socket.on('room:joined', (data: { playerId: string; reconnectToken: string; gameState: GameState }) => {
      setPlayerId(data.playerId);
      setGameState(data.gameState, data.playerId);
      socketService.setReconnectToken(data.reconnectToken);
      const roomCode = useGameStore.getState().room.roomCode;
      if (roomCode) {
        socketService.setRoomCode(roomCode);
      }
      setIsLoading(false);
      navigate(`/lobby/${roomCode}`);
    });

    socket.on('room:playerJoined', (data: { player: Player }) => {
      addPlayer(data.player);
    });

    socket.on('room:playerLeft', (data: { playerId: string }) => {
      removePlayer(data.playerId);
    });

    socket.on('room:error', (data: { message: string }) => {
      setError(data.message);
      setIsLoading(false);
      // Show error toast
      toast.error(data.message);
    });

    socket.on('room:configUpdated', (data: { config: GameConfig }) => {
      setRoomConfig(data.config);
    });

    socket.on('room:hostChanged', (data: { newHostId: string }) => {
      setHostId(data.newHostId);
    });

    // Game state events
    socket.on('game:stateUpdate', (data: { gameState: GameState }) => {
      setGameState(data.gameState);
    });

    socket.on('game:phaseChange', (data: { phase: GamePhase; gameState: GameState }) => {
      setGameState(data.gameState);
      setIsLoading(false);

      // Handle phase-specific navigation and state updates
      const roomCode = useGameStore.getState().room.roomCode;
      switch (data.phase) {
        case GamePhaseEnum.INITIAL_ROLL:
        case GamePhaseEnum.PREDICTION:
        case GamePhaseEnum.SET_SELECTION:
        case GamePhaseEnum.SET_REVEAL:
        case GamePhaseEnum.ROUND_SUMMARY:
        case GamePhaseEnum.GAME_OVER:
          // Navigate to game page if not already there
          if (roomCode) navigate(`/game/${roomCode}`);
          break;
        case GamePhaseEnum.LOBBY:
          if (roomCode) navigate(`/lobby/${roomCode}`);
          break;
      }

      // Show results modal on set reveal or round summary
      if (data.phase === GamePhaseEnum.SET_REVEAL) {
        setShowResultsModal(true);
        setResultsModalType('set');
      } else if (data.phase === GamePhaseEnum.ROUND_SUMMARY) {
        setShowResultsModal(true);
        setResultsModalType('round');
      } else if (data.phase === GamePhaseEnum.GAME_OVER) {
        setShowResultsModal(true);
        setResultsModalType('game');
      }

      // Reset state for new phases
      if (data.phase === GamePhaseEnum.PREDICTION) {
        resetForNewRound();
      } else if (data.phase === GamePhaseEnum.SET_SELECTION) {
        // Only reset for new set if coming from set reveal
        const currentGame = useGameStore.getState().game;
        if (currentGame && currentGame.currentSet === 2) {
          resetForNewSet();
        }
      }
    });

    socket.on('game:turnStart', (data: { playerId: string; timeRemaining: number }) => {
      setCurrentTurnPlayer(data.playerId);
      setTimeRemaining(data.timeRemaining);
    });

    socket.on('game:timerTick', (data: { timeRemaining: number }) => {
      setTimeRemaining(data.timeRemaining);
    });

    socket.on('game:initialRoll', (data: { results: { playerId: string; roll: number }[]; turnOrder: string[] }) => {
      setInitialRollResults(data.results);
    });

    // Prediction events
    socket.on('prediction:submitted', (data: { playerId: string }) => {
      // If it's our prediction, mark it as submitted
      const currentPlayerId = useGameStore.getState().player.playerId;
      if (data.playerId === currentPlayerId) {
        setHasSubmittedPrediction(true);
      }
    });

    socket.on('prediction:allSubmitted', () => {
      // All predictions submitted - state machine will transition
    });

    socket.on('prediction:autoSubmitting', (data: { countdown: number }) => {
      // Show toast notification that auto-submission is happening
      toast.info(`Auto-selecting prediction in ${data.countdown}s...`);
    });

    // Dice events
    socket.on('dice:rolled', (data: { gameState: GameState }) => {
      setGameState(data.gameState);
    });

    socket.on('dice:selected', (data: { playerId: string; visibleDice: Die[]; hiddenCount: number }) => {
      // Store visible dice for this opponent
      const currentPlayerId = useGameStore.getState().player.playerId;
      if (data.playerId !== currentPlayerId) {
        setOpponentVisibleDice(data.playerId, data.visibleDice);
      }
    });

    socket.on('dice:confirmed', (data: { playerId: string }) => {
      markPlayerConfirmed(data.playerId);

      // If it's our confirmation, mark it
      const currentPlayerId = useGameStore.getState().player.playerId;
      if (data.playerId === currentPlayerId) {
        setHasConfirmedSelection(true);
      }
    });

    // Results events
    socket.on('set:reveal', (data: { results: SetResult[]; gameState: GameState }) => {
      setSetResults(data.results);
      setGameState(data.gameState);
      resetResultsAcknowledgement(); // Reset acknowledgement tracking for new results
      setShowResultsModal(true);
      setResultsModalType('set');
    });

    socket.on('round:complete', (data: { result: RoundResult; gameState: GameState }) => {
      addRoundResult(data.result);
      setGameState(data.gameState);
      resetResultsAcknowledgement(); // Reset acknowledgement tracking for new results
      setShowResultsModal(true);
      setResultsModalType('round');
    });

    socket.on('game:over', () => {
      resetResultsAcknowledgement(); // Reset acknowledgement tracking for new results
      setShowResultsModal(true);
      setResultsModalType('game');
    });

    // Results acknowledgement events
    socket.on('results:acknowledged', (data: { playerId: string; acknowledgedCount: number; totalCount: number }) => {
      setAcknowledgementProgress(data.acknowledgedCount, data.totalCount);
    });

    socket.on('results:waitingFor', (data: { waitingForPlayerIds: string[] }) => {
      setWaitingForPlayerIds(data.waitingForPlayerIds);
    });

    // Connection events
    socket.on('player:disconnected', (data: { playerId: string }) => {
      updatePlayerConnection(data.playerId, false);
    });

    socket.on('player:reconnected', (data: { playerId: string }) => {
      updatePlayerConnection(data.playerId, true);
    });

    socket.on('reconnect:success', (data: { gameState: GameState; playerId: string }) => {
      setPlayerId(data.playerId);
      setGameState(data.gameState, data.playerId);
      setConnectionStatus('connected');
      toast.success('Reconnected successfully!');

      // Navigate based on game phase
      const phase = data.gameState.phase;
      const roomCode = data.gameState.roomCode || socketService.getRoomCode();
      if (roomCode) {
        socketService.setRoomCode(roomCode);
        setRoomCode(roomCode);
      }
      if (phase === GamePhaseEnum.LOBBY) {
        navigate(roomCode ? `/lobby/${roomCode}` : '/');
      } else {
        navigate(roomCode ? `/game/${roomCode}` : '/');
      }
    });

    socket.on('reconnect:failed', (data: { message: string }) => {
      setError(data.message);
      setIsLoading(false);
      socketService.clearReconnectToken();
      toast.error(data.message);
      navigate('/');
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('room:created');
      socket.off('room:joined');
      socket.off('room:playerJoined');
      socket.off('room:playerLeft');
      socket.off('room:error');
      socket.off('room:configUpdated');
      socket.off('room:hostChanged');
      socket.off('game:stateUpdate');
      socket.off('game:phaseChange');
      socket.off('game:turnStart');
      socket.off('game:timerTick');
      socket.off('game:initialRoll');
      socket.off('prediction:submitted');
      socket.off('prediction:allSubmitted');
      socket.off('prediction:autoSubmitting');
      socket.off('dice:rolled');
      socket.off('dice:selected');
      socket.off('dice:confirmed');
      socket.off('set:reveal');
      socket.off('round:complete');
      socket.off('game:over');
      socket.off('results:acknowledged');
      socket.off('results:waitingFor');
      socket.off('player:disconnected');
      socket.off('player:reconnected');
      socket.off('reconnect:success');
      socket.off('reconnect:failed');
    };
  }, [navigate]);

  return null;
}

// Toast provider wrapper
function ToastProvider() {
  const { toasts, dismiss } = useToast();
  return <ToastContainer toasts={toasts} onDismiss={dismiss} />;
}

function App() {
  return (
    <BrowserRouter>
      <SocketHandler />
      <ConnectionOverlay />
      <ToastProvider />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lobby/:roomCode" element={<Lobby />} />
        <Route path="/game/:roomCode" element={<Game />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
