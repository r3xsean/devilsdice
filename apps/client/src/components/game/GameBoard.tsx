import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Player, Die as DieType, SetResult } from '@devilsdice/shared';
import { GamePhase, PredictionType } from '@devilsdice/shared';
import { PhaseIndicator } from './PhaseIndicator';
import { TurnIndicator } from './TurnIndicator';
import { PlayerArea } from './PlayerArea';
import { Scoreboard } from './Scoreboard';
import { PredictionPanel } from './PredictionPanel';
import { ResultsModal } from './ResultsModal';

interface PredictionResult {
  playerId: string;
  playerName: string;
  type: PredictionType;
  correct: boolean;
  bonus: number;
}

interface RoundResultData {
  roundNumber: number;
  set1Results: SetResult[];
  set2Results: SetResult[];
  predictions: {
    playerId: string;
    type: PredictionType;
    correct: boolean;
    bonus: number;
  }[];
}

interface FinalStanding {
  playerId: string;
  playerName: string;
  cumulativeScore: number;
  placement: number;
}

interface GameBoardProps {
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  currentSet: 1 | 2;
  players: Player[];
  currentPlayerId: string;
  currentTurnPlayerId: string;
  myDice: DieType[];
  selectedDiceIds: string[];
  pendingSelections: Record<string, string[]>;
  timeRemaining: number;
  totalTime: number;
  setResults: SetResult[];
  predictions?: PredictionResult[];
  roundResult?: RoundResultData; // Full round result for round summary
  finalStandings?: FinalStanding[]; // For game over - final player rankings
  onDieSelect: (dieId: string) => void;
  onConfirmSelection: () => void;
  onSubmitPrediction: (type: PredictionType) => void;
  onCloseResults: () => void;
  hasSubmittedPrediction: boolean;
  hasConfirmedSelection: boolean;
  selectedPrediction?: PredictionType;
  predictionStatus?: Record<string, boolean>;
  showResultsModal?: boolean;
  resultsModalType?: 'set' | 'round' | 'game';
  hasAcknowledgedResults?: boolean;
  waitingForPlayerIds?: string[];
  acknowledgedCount?: number;
  totalPlayersCount?: number;
}

export function GameBoard({
  phase,
  currentRound,
  totalRounds,
  currentSet,
  players,
  currentPlayerId,
  currentTurnPlayerId,
  myDice,
  selectedDiceIds,
  pendingSelections,
  timeRemaining,
  totalTime,
  setResults,
  predictions = [],
  roundResult,
  finalStandings = [],
  onDieSelect,
  onConfirmSelection,
  onSubmitPrediction,
  onCloseResults,
  hasSubmittedPrediction,
  hasConfirmedSelection,
  selectedPrediction,
  predictionStatus,
  showResultsModal = false,
  resultsModalType = 'set',
  hasAcknowledgedResults = false,
  waitingForPlayerIds = [],
  acknowledgedCount = 0,
  totalPlayersCount = 0,
}: GameBoardProps) {
  const isMyTurn = currentTurnPlayerId === currentPlayerId;

  const myPlayer = useMemo(
    () => players.find((p) => p.id === currentPlayerId),
    [players, currentPlayerId]
  );

  const selectedDiceCount = selectedDiceIds.length;

  const currentTurnPlayerName = useMemo(() => {
    const player = players.find((p) => p.id === currentTurnPlayerId);
    return player?.name || 'Unknown';
  }, [players, currentTurnPlayerId]);

  const playerNames = useMemo(() => {
    const map: Record<string, string> = {};
    players.forEach((p) => {
      map[p.id] = p.name;
    });
    return map;
  }, [players]);

  const showSelectionUI = phase === GamePhase.SET_SELECTION;
  const showPredictionUI = phase === GamePhase.PREDICTION;

  // Sort players: current player first, then others
  const sortedPlayers = useMemo(() => {
    const me = players.find((p) => p.id === currentPlayerId);
    const others = players.filter((p) => p.id !== currentPlayerId);
    return me ? [me, ...others] : others;
  }, [players, currentPlayerId]);

  // Grid columns based on total player count
  // Account for sidebar (w-80 at lg, w-96 at xl) reducing available space
  const getGridCols = () => {
    const count = sortedPlayers.length;
    if (count === 1) return 'grid-cols-1 max-w-xl mx-auto';
    if (count === 2) return 'grid-cols-1 2xl:grid-cols-2';
    if (count === 3) return 'grid-cols-1 2xl:grid-cols-2';
    return 'grid-cols-1 2xl:grid-cols-2';
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[400px] bg-[var(--color-blood)]/15 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 right-1/4 w-[500px] h-[300px] bg-[var(--color-abyss)]/20 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--color-ruby)]/5 rounded-full blur-[150px]" />
      </div>

      {/* Top Section: Phase Indicator */}
      <header className="flex-shrink-0 py-4 px-4 border-b border-[var(--color-ruby)]/20 bg-[var(--color-obsidian)]/80 backdrop-blur-sm relative z-10">
        <PhaseIndicator
          phase={phase}
          currentSet={currentSet}
          currentRound={currentRound}
        />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative z-10">
        {/* Left/Center: Game Area */}
        <div className="flex-1 flex flex-col p-4 overflow-y-auto">
          {/* All Players Area - unified grid */}
          <div className="mb-4">
            <div className={`grid gap-3 ${getGridCols()}`}>
              {sortedPlayers.map((player) => {
                const isSelf = player.id === currentPlayerId;
                // Use myDice for self (has full dice data), player.dice for others
                const playerWithDice = isSelf && myPlayer
                  ? { ...player, dice: myDice }
                  : player;

                // Get selected dice IDs for this player
                // For self: prefer local selectedDiceIds for immediate feedback during selection,
                // but fall back to pendingSelections if local is empty (e.g., after auto-selection on timeout)
                // For others: always use pendingSelections from server
                const serverSelectedIds = pendingSelections[player.id] || [];
                const playerSelectedIds = isSelf
                  ? (selectedDiceIds.length > 0 ? selectedDiceIds : serverSelectedIds)
                  : serverSelectedIds;

                // Check if player has confirmed (has :confirmed key in pendingSelections)
                const playerHasConfirmed = isSelf
                  ? hasConfirmedSelection
                  : !!pendingSelections[`${player.id}:confirmed`];

                return (
                  <PlayerArea
                    key={player.id}
                    player={playerWithDice}
                    isCurrentTurn={player.id === currentTurnPlayerId}
                    currentSet={currentSet}
                    playerCount={players.length}
                    isSelf={isSelf}
                    selectedDiceIds={playerSelectedIds}
                    onDieSelect={isSelf ? onDieSelect : undefined}
                    canSelectDice={isSelf && showSelectionUI && isMyTurn && !hasConfirmedSelection}
                    selectionStatus={
                      showSelectionUI
                        ? (playerHasConfirmed ? 'confirmed' : 'selecting')
                        : null
                    }
                  />
                );
              })}
            </div>
          </div>

          {/* Turn Indicator */}
          {showSelectionUI && (
            <div className="mb-4 card-noir p-4">
              <TurnIndicator
                currentPlayerName={currentTurnPlayerName}
                timeRemaining={timeRemaining}
                isYourTurn={isMyTurn}
                totalTime={totalTime}
              />
            </div>
          )}

          {/* Phase-specific content */}
          <div className="flex-1 flex flex-col justify-end">
            <AnimatePresence mode="wait">
              {/* Prediction Phase */}
              {showPredictionUI && (
                <motion.div
                  key="prediction"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <PredictionPanel
                    onSubmit={onSubmitPrediction}
                    disabled={hasSubmittedPrediction}
                    submitted={hasSubmittedPrediction}
                    selectedPrediction={selectedPrediction}
                    timeRemaining={timeRemaining}
                    totalTime={totalTime}
                    playerCount={players.length}
                  />
                </motion.div>
              )}

              {/* Selection Phase - Confirm Button */}
              {showSelectionUI && (
                <motion.div
                  key="selection"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex justify-center"
                >
                  {hasConfirmedSelection ? (
                    <div className="card-noir px-6 py-3 inline-flex items-center gap-2 text-green-400">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Selection Confirmed</span>
                    </div>
                  ) : !isMyTurn ? (
                    <div className="card-noir px-6 py-3 inline-block text-[var(--color-honey)] text-sm">
                      Waiting for your turn...
                    </div>
                  ) : selectedDiceCount === 3 ? (
                    <motion.button
                      type="button"
                      onClick={onConfirmSelection}
                      whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(34, 197, 94, 0.4)' }}
                      whileTap={{ scale: 0.98 }}
                      animate={{
                        boxShadow: [
                          '0 0 10px rgba(34, 197, 94, 0.2)',
                          '0 0 25px rgba(34, 197, 94, 0.4)',
                          '0 0 10px rgba(34, 197, 94, 0.2)',
                        ],
                      }}
                      transition={{
                        boxShadow: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
                      }}
                      className="px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 hover:from-green-600 hover:via-emerald-600 hover:to-green-700 text-white flex items-center gap-3"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Confirm Selection
                    </motion.button>
                  ) : (
                    <div className="card-noir px-6 py-3 inline-block text-gray-400 text-sm">
                      Select 3 dice from your pool
                    </div>
                  )}
                </motion.div>
              )}

              {/* Reveal Phase */}
              {phase === GamePhase.SET_REVEAL && setResults.length > 0 && (
                <motion.div
                  key="reveal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-12"
                >
                  <motion.div
                    animate={{
                      scale: [1, 1.05, 1],
                      opacity: [0.7, 1, 0.7]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-3xl text-[var(--color-champagne)] font-display font-bold"
                  >
                    Revealing hands...
                  </motion.div>
                </motion.div>
              )}

              {/* Round Summary */}
              {phase === GamePhase.ROUND_SUMMARY && (
                <motion.div
                  key="summary"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-12"
                >
                  <h2 className="text-3xl text-[var(--color-ivory)] font-display font-bold mb-3">
                    Round {currentRound} Complete
                  </h2>
                  <p className="text-[var(--color-pewter)]">Preparing next round...</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Sidebar: Scoreboard */}
        <aside className="lg:w-80 xl:w-96 flex-shrink-0 p-4 lg:border-l border-[var(--color-ruby)]/20 bg-[var(--color-obsidian)]/50">
          <div className="sticky top-4">
            <Scoreboard
              players={players}
              currentRound={currentRound}
              totalRounds={totalRounds}
              currentPlayerId={currentPlayerId}
              predictionStatus={predictionStatus}
            />
          </div>
        </aside>
      </main>

      {/* Results Modal */}
      <AnimatePresence>
        {showResultsModal && (setResults.length > 0 || finalStandings.length > 0 || predictions.length > 0) && (
          <ResultsModal
            type={resultsModalType}
            results={setResults}
            predictions={predictions}
            roundResult={roundResult}
            finalStandings={finalStandings}
            currentRound={currentRound}
            playerNames={playerNames}
            playerCount={players.length}
            onClose={onCloseResults}
            hasAcknowledgedResults={hasAcknowledgedResults}
            waitingForPlayerIds={waitingForPlayerIds}
            acknowledgedCount={acknowledgedCount}
            totalPlayersCount={totalPlayersCount}
            // No autoCloseDelay - user must click Continue
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default GameBoard;
