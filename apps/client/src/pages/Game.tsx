import { useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '@/stores/gameStore';
import { getSocket } from '@/services/socket';
import { GamePhase, PredictionType } from '@devilsdice/shared';
import { GameBoard } from '@/components/game';

interface PredictionResult {
  playerId: string;
  playerName: string;
  type: PredictionType;
  correct: boolean;
  bonus: number;
}

interface FinalStanding {
  playerId: string;
  playerName: string;
  cumulativeScore: number;
  placement: number;
}

export default function Game() {
  const navigate = useNavigate();
  const { roomCode } = useParams<{ roomCode: string }>();
  const {
    game,
    room,
    player,
    ui,
    toggleDieSelection,
    setSelectedDice,
    setHasSubmittedPrediction,
    setHasConfirmedSelection,
    setMyPrediction,
    setShowResultsModal,
    setHasAcknowledgedResults,
    setError,
  } = useGameStore();

  const socket = getSocket();

  // Redirect if not in a game
  useEffect(() => {
    if (!game || game.phase === GamePhase.LOBBY) {
      // If we have a room code but no game, go to lobby
      if (roomCode && room.roomCode === roomCode) {
        navigate(`/lobby/${roomCode}`);
      } else if (!room.roomCode) {
        // No room at all, go home
        navigate('/');
      }
    }
  }, [game, navigate, roomCode, room.roomCode]);

  // Redirect to home on game over after delay
  useEffect(() => {
    if (game?.phase === GamePhase.GAME_OVER) {
      const timer = setTimeout(() => {
        navigate('/');
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [game?.phase, navigate]);

  // Handlers
  const handleSelectDie = useCallback((dieId: string) => {
    toggleDieSelection(dieId);
  }, [toggleDieSelection]);

  const handleConfirmSelection = useCallback(() => {
    if (socket && game) {
      // First send the dice selection, then confirm
      socket.emit('dice:select', { dieIds: game.selectedDiceIds });
      socket.emit('dice:confirm');
      setHasConfirmedSelection(true);
    }
  }, [socket, game, setHasConfirmedSelection]);

  const handleSubmitPrediction = useCallback((type: PredictionType) => {
    if (socket) {
      socket.emit('prediction:submit', { type });
      setMyPrediction(type);
      setHasSubmittedPrediction(true);
    }
  }, [socket, setMyPrediction, setHasSubmittedPrediction]);

  const handleCloseResults = useCallback(() => {
    if (socket) {
      // Mark that we've acknowledged - modal stays open until all players acknowledge
      setHasAcknowledgedResults(true);
      // Clear selected dice for next selection
      setSelectedDice([]);
      setHasConfirmedSelection(false);
      // Notify server we've acknowledged results
      socket.emit('game:acknowledgeResults');
      // Note: Modal will be closed by phase change event when all players acknowledge
    }
  }, [setHasAcknowledgedResults, setSelectedDice, setHasConfirmedSelection, socket]);

  // Get actual values from store
  const currentPhase = game?.phase ?? GamePhase.LOBBY;
  const currentRound = game?.currentRound ?? 1;
  const currentSet = game?.currentSet ?? 1;
  const currentDice = game?.myDice ?? [];
  const currentSelectedIds = game?.selectedDiceIds ?? [];
  const currentPlayers = room.players;
  const currentPlayerId = player.playerId ?? '';
  const currentTurnPlayerId = game?.currentTurnPlayerId ?? game?.turnOrder?.[game?.currentTurnIndex ?? 0] ?? '';
  const timeRemaining = game?.timeRemaining ?? 0;
  const hasSubmittedPrediction = player.hasSubmittedPrediction;
  const hasConfirmedSelection = player.hasConfirmedSelection;
  const selectedPrediction = player.myPrediction ?? undefined;
  const setResults = game?.setResults ?? [];
  const pendingSelections = game?.pendingSelections ?? {};
  const totalRounds = room.config?.totalRounds ?? 5;
  const totalTime = room.config?.turnTimerSeconds ?? 30;
  const showResults = ui.showResultsModal;
  const resultsType = ui.resultsModalType;
  const roundHistory = game?.roundHistory ?? [];

  // Get the latest round result for round summary modal
  const latestRoundResult = useMemo(() => {
    if (roundHistory.length === 0) return undefined;
    return roundHistory[roundHistory.length - 1];
  }, [roundHistory]);

  // Construct predictions with player names for round modal
  const predictions: PredictionResult[] = useMemo(() => {
    if (resultsType !== 'round' || !latestRoundResult) return [];

    return latestRoundResult.predictions.map((pred) => {
      const p = currentPlayers.find(pl => pl.id === pred.playerId);
      return {
        playerId: pred.playerId,
        playerName: p?.name ?? 'Unknown',
        type: pred.type,
        correct: pred.correct,
        bonus: pred.bonus,
      };
    });
  }, [resultsType, latestRoundResult, currentPlayers]);

  // Construct final standings for game over modal
  const finalStandings: FinalStanding[] = useMemo(() => {
    if (resultsType !== 'game') return [];

    // Sort players by cumulative score (descending)
    const sortedPlayers = [...currentPlayers].sort((a, b) => b.cumulativeScore - a.cumulativeScore);

    return sortedPlayers.map((p, index) => ({
      playerId: p.id,
      playerName: p.name,
      cumulativeScore: p.cumulativeScore,
      placement: index + 1,
    }));
  }, [resultsType, currentPlayers]);

  // Error display
  if (ui.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 max-w-md">
          <h2 className="text-red-400 font-bold text-lg mb-2">Error</h2>
          <p className="text-red-300">{ui.error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              navigate('/');
            }}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  // If no game, show loading or redirect will happen
  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--color-pewter)]">Loading...</div>
      </div>
    );
  }

  return (
    <GameBoard
      phase={currentPhase}
      currentRound={currentRound}
      totalRounds={totalRounds}
      currentSet={currentSet}
      players={currentPlayers}
      currentPlayerId={currentPlayerId}
      currentTurnPlayerId={currentTurnPlayerId}
      myDice={currentDice}
      selectedDiceIds={currentSelectedIds}
      pendingSelections={pendingSelections}
      timeRemaining={timeRemaining}
      totalTime={totalTime}
      setResults={setResults}
      predictions={predictions}
      roundResult={latestRoundResult}
      finalStandings={finalStandings}
      onDieSelect={handleSelectDie}
      onConfirmSelection={handleConfirmSelection}
      onSubmitPrediction={handleSubmitPrediction}
      onCloseResults={handleCloseResults}
      hasSubmittedPrediction={hasSubmittedPrediction}
      hasConfirmedSelection={hasConfirmedSelection}
      selectedPrediction={selectedPrediction}
      showResultsModal={showResults}
      resultsModalType={resultsType}
      hasAcknowledgedResults={ui.hasAcknowledgedResults}
      waitingForPlayerIds={ui.waitingForPlayerIds}
      acknowledgedCount={ui.acknowledgedCount}
      totalPlayersCount={ui.totalPlayersCount}
    />
  );
}
