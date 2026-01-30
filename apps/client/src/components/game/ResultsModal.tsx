import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import type { SetResult, PredictionType, RoundResult } from '@devilsdice/shared';
import { getPredictionInfo } from '@devilsdice/shared';
import { Die } from '@/components/dice';

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

interface ResultsModalProps {
  type: 'set' | 'round' | 'game';
  results: SetResult[];
  predictions?: PredictionResult[];
  roundResult?: RoundResult; // Full round result for round summary
  finalStandings?: FinalStanding[]; // For game over - final player rankings
  currentRound?: number;
  playerNames: Record<string, string>;
  playerCount: number; // Number of players, used to display correct prediction names
  onClose: () => void;
  autoCloseDelay?: number; // If not provided, no auto-close (user must click Continue)
  hasAcknowledgedResults?: boolean; // Whether this player has clicked Continue
  waitingForPlayerIds?: string[]; // Player IDs we're still waiting for
  acknowledgedCount?: number; // Number of players who have acknowledged
  totalPlayersCount?: number; // Total number of connected players
}

// Animated counter component for score tick-up effect
function AnimatedScore({ value, delay = 0 }: { value: number; delay?: number }) {
  const count = useMotionValue(0);
  const [displayValue, setDisplayValue] = useState('0.0');

  // Transform is used internally by Framer Motion
  useTransform(count, (latest) => latest.toFixed(1));

  useEffect(() => {
    const timeout = setTimeout(() => {
      const controls = animate(count, value, {
        duration: 0.8,
        ease: 'easeOut',
        onUpdate: (latest) => setDisplayValue(latest.toFixed(1)),
      });
      return () => controls.stop();
    }, delay);
    return () => clearTimeout(timeout);
  }, [count, value, delay]);

  return <span>{displayValue}</span>;
}

// Placement badge with medal styling
function PlacementBadge({ placement, delay }: { placement: number; delay: number }) {
  const badgeColors = {
    1: {
      bg: 'bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-600',
      text: 'text-yellow-900',
      shadow: 'shadow-yellow-500/50',
      icon: 'gold',
    },
    2: {
      bg: 'bg-gradient-to-br from-gray-200 via-gray-400 to-gray-500',
      text: 'text-gray-800',
      shadow: 'shadow-gray-400/50',
      icon: 'silver',
    },
    3: {
      bg: 'bg-gradient-to-br from-amber-400 via-amber-600 to-amber-700',
      text: 'text-amber-900',
      shadow: 'shadow-amber-500/50',
      icon: 'bronze',
    },
  };

  const style = badgeColors[placement as 1 | 2 | 3] || {
    bg: 'bg-gray-600',
    text: 'text-gray-300',
    shadow: '',
    icon: '',
  };

  return (
    <motion.div
      initial={{ scale: 0, rotate: -180, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{
        delay,
        type: 'spring',
        stiffness: 400,
        damping: 15,
      }}
      className="relative"
    >
      <motion.div
        className={`
          w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl
          ${style.bg} ${style.text}
          shadow-lg ${style.shadow}
        `}
        animate={placement <= 3 ? {
          boxShadow: [
            `0 4px 15px rgba(0,0,0,0.2)`,
            `0 4px 25px rgba(0,0,0,0.3)`,
            `0 4px 15px rgba(0,0,0,0.2)`,
          ],
        } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {placement}
      </motion.div>
      {placement === 1 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + 0.3, type: 'spring' }}
          className="absolute -top-1 -right-1 text-lg"
        >
          <span role="img" aria-label="winner" className="drop-shadow-lg">&#x1F451;</span>
        </motion.div>
      )}
    </motion.div>
  );
}

// Checkmark/X animation for predictions
function PredictionIcon({ correct, delay }: { correct: boolean; delay: number }) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ delay, type: 'spring', stiffness: 500, damping: 20 }}
      className={`
        w-8 h-8 rounded-full flex items-center justify-center
        ${correct ? 'bg-green-500' : 'bg-red-500'}
      `}
    >
      {correct ? (
        <motion.svg
          viewBox="0 0 24 24"
          className="w-5 h-5 text-white"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: delay + 0.2, duration: 0.3 }}
        >
          <motion.path
            d="M5 13l4 4L19 7"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: delay + 0.2, duration: 0.3 }}
          />
        </motion.svg>
      ) : (
        <motion.svg
          viewBox="0 0 24 24"
          className="w-5 h-5 text-white"
        >
          <motion.path
            d="M6 6l12 12M6 18L18 6"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: delay + 0.2, duration: 0.3 }}
          />
        </motion.svg>
      )}
    </motion.div>
  );
}

export function ResultsModal({
  type,
  results,
  predictions = [],
  roundResult,
  finalStandings = [],
  currentRound,
  playerNames,
  playerCount,
  onClose,
  autoCloseDelay,
  hasAcknowledgedResults = false,
  waitingForPlayerIds = [],
  acknowledgedCount = 0,
  totalPlayersCount = 0,
}: ResultsModalProps) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [showPredictions, setShowPredictions] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [allAnimationsComplete, setAllAnimationsComplete] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // For round type, we skip set results and show predictions directly
  // For game type, we show final standings instead of set results
  const showSetResults = type === 'set';
  const showFinalStandings = type === 'game';

  // Sort final standings by placement
  const sortedStandings = [...finalStandings].sort((a, b) => a.placement - b.placement);

  // Determine what we're revealing based on type
  const itemsToReveal = type === 'game' ? sortedStandings.length : results.length;

  // Animate reveal of results one by one with dramatic stagger
  useEffect(() => {
    // For round type, immediately show predictions (no set results to reveal)
    if (type === 'round') {
      if (!showPredictions && predictions.length > 0) {
        const timer = setTimeout(() => {
          setShowPredictions(true);
        }, 300);
        return () => clearTimeout(timer);
      } else {
        setAllAnimationsComplete(true);
      }
      return;
    }

    // For set type, reveal set results one by one
    if (type === 'set') {
      if (revealedCount < results.length) {
        const timer = setTimeout(() => {
          setRevealedCount((prev) => prev + 1);
        }, 600);
        return () => clearTimeout(timer);
      } else {
        setAllAnimationsComplete(true);
      }
      return;
    }

    // For game type, reveal final standings one by one
    if (type === 'game') {
      if (revealedCount < sortedStandings.length) {
        const timer = setTimeout(() => {
          setRevealedCount((prev) => prev + 1);
          // Show confetti when first place is revealed
          if (revealedCount === 0) {
            setShowConfetti(true);
          }
        }, 800); // Slower for more dramatic effect
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          setAllAnimationsComplete(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [revealedCount, results.length, sortedStandings.length, type, predictions.length, showPredictions]);

  // Auto-close timer - only if explicitly set and all animations done
  // Default behavior: NO auto-close, user must click Continue
  useEffect(() => {
    if (autoCloseDelay && allAnimationsComplete) {
      const timer = setTimeout(onClose, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [autoCloseDelay, allAnimationsComplete, onClose]);

  // Sort results by placement
  const sortedResults = [...results].sort((a, b) => a.placement - b.placement);

  const headerText = {
    set: 'Set Results',
    round: `Round ${currentRound ?? ''} Complete`,
    game: 'Game Over',
  };

  const subtitleText = {
    set: 'See how everyone performed',
    round: 'Predictions revealed!',
    game: 'Final Standings',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Confetti effect for game winner */}
      <AnimatePresence>
        {showConfetti && type === 'game' && (
          <div className="fixed inset-0 pointer-events-none overflow-hidden">
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={i}
                initial={{
                  x: Math.random() * window.innerWidth,
                  y: -20,
                  rotate: 0,
                  scale: Math.random() * 0.5 + 0.5,
                }}
                animate={{
                  y: window.innerHeight + 20,
                  rotate: Math.random() * 720 - 360,
                }}
                transition={{
                  duration: Math.random() * 2 + 2,
                  delay: Math.random() * 0.5,
                  ease: 'linear',
                }}
                className={`
                  absolute w-3 h-3 rounded-sm
                  ${['bg-yellow-400', 'bg-red-500', 'bg-blue-500', 'bg-green-400', 'bg-purple-500', 'bg-pink-400'][i % 6]}
                `}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      <motion.div
        ref={modalRef}
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 50 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl border border-crimson/30 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        {/* Header with dramatic styling */}
        <motion.div
          className="px-6 py-5 border-b border-gray-700/50 sticky top-0 bg-gradient-to-b from-gray-800 to-gray-800/95 z-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <motion.h2
            className="text-2xl md:text-3xl font-display font-bold text-center"
            animate={type === 'game' || type === 'round' ? {
              color: ['#ffffff', type === 'game' ? '#fbbf24' : '#dc2626', '#ffffff'],
              textShadow: [
                '0 0 10px rgba(251, 191, 36, 0)',
                `0 0 20px ${type === 'game' ? 'rgba(251, 191, 36, 0.5)' : 'rgba(220, 38, 38, 0.5)'}`,
                '0 0 10px rgba(251, 191, 36, 0)',
              ],
            } : { color: '#ffffff' }}
            transition={{ duration: 2, repeat: type === 'game' || type === 'round' ? Infinity : 0 }}
          >
            {headerText[type]}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className={`text-center text-sm mt-1 ${type === 'game' ? 'text-gold/80' : type === 'round' ? 'text-crimson/80' : 'text-gray-400'}`}
          >
            {subtitleText[type]}
          </motion.p>
        </motion.div>

        {/* Results */}
        <div className="p-4 md:p-6 space-y-4">
          {/* Set Results - only show for 'set' and 'game' types */}
          {showSetResults && (
            <AnimatePresence mode="popLayout">
              {sortedResults.slice(0, revealedCount).map((result) => {
                const playerName = playerNames[result.playerId] || 'Unknown';
                const revealDelay = 0.1;

                return (
                  <motion.div
                    key={result.playerId}
                    initial={{ opacity: 0, x: -50, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 300,
                      damping: 25,
                    }}
                    className={`
                      p-4 rounded-xl border-2 relative overflow-hidden
                      ${result.placement === 1 ? 'bg-gradient-to-r from-yellow-500/20 via-yellow-500/10 to-transparent border-yellow-500/50' : ''}
                      ${result.placement === 2 ? 'bg-gradient-to-r from-gray-400/20 via-gray-400/10 to-transparent border-gray-400/50' : ''}
                      ${result.placement === 3 ? 'bg-gradient-to-r from-amber-600/20 via-amber-600/10 to-transparent border-amber-600/50' : ''}
                      ${result.placement > 3 ? 'bg-gray-700/30 border-gray-600/30' : ''}
                    `}
                  >
                  {/* Shine effect for top 3 */}
                  {result.placement <= 3 && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
                      initial={{ x: '-100%' }}
                      animate={{ x: '200%' }}
                      transition={{ delay: revealDelay + 0.3, duration: 0.8 }}
                    />
                  )}

                  <div className="flex items-center justify-between relative z-10">
                    {/* Placement and player */}
                    <div className="flex items-center gap-4">
                      <PlacementBadge placement={result.placement} delay={revealDelay} />

                      {/* Player info */}
                      <div>
                        <motion.p
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: revealDelay + 0.1 }}
                          className={`font-semibold text-lg ${result.placement === 1 ? 'text-yellow-100' : 'text-white'}`}
                        >
                          {playerName}
                        </motion.p>
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: revealDelay + 0.2 }}
                          className="text-sm text-crimson/80"
                        >
                          {result.hand.description}
                        </motion.p>
                      </div>
                    </div>

                    {/* Points with counting animation */}
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: revealDelay + 0.2, type: 'spring' }}
                      className="text-right"
                    >
                      <motion.p
                        className="text-2xl font-bold text-green-400"
                        animate={result.placement === 1 ? {
                          scale: [1, 1.1, 1],
                        } : {}}
                        transition={{ delay: revealDelay + 0.5, duration: 0.3 }}
                      >
                        +<AnimatedScore value={result.pointsEarned} delay={(revealDelay + 0.3) * 1000} />
                      </motion.p>
                      <p className="text-xs text-gray-400">points</p>
                    </motion.div>
                  </div>

                  {/* Dice used with stagger animation */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: revealDelay + 0.4 }}
                    className="mt-3 flex gap-2"
                  >
                    {(result.diceValues || []).map((die, dieIdx) => (
                      <motion.div
                        key={die.id}
                        initial={{ opacity: 0, scale: 0, rotate: -180 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{
                          delay: revealDelay + 0.5 + dieIdx * 0.1,
                          type: 'spring',
                          stiffness: 400,
                        }}
                      >
                        <Die
                          die={die}
                          size="sm"
                          forceReveal={true}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          )}

          {/* Final Standings - only show for 'game' type */}
          {showFinalStandings && (
            <AnimatePresence mode="popLayout">
              {sortedStandings.slice(0, revealedCount).map((standing, idx) => {
                const revealDelay = 0.1;
                const isWinner = standing.placement === 1;

                return (
                  <motion.div
                    key={standing.playerId}
                    initial={{ opacity: 0, x: -50, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 300,
                      damping: 25,
                    }}
                    className={`
                      p-5 rounded-xl border-2 relative overflow-hidden
                      ${standing.placement === 1 ? 'bg-gradient-to-r from-yellow-500/30 via-yellow-500/15 to-transparent border-yellow-500/60' : ''}
                      ${standing.placement === 2 ? 'bg-gradient-to-r from-gray-400/25 via-gray-400/10 to-transparent border-gray-400/50' : ''}
                      ${standing.placement === 3 ? 'bg-gradient-to-r from-amber-600/25 via-amber-600/10 to-transparent border-amber-600/50' : ''}
                      ${standing.placement > 3 ? 'bg-gray-700/30 border-gray-600/30' : ''}
                    `}
                  >
                    {/* Shine effect for winner */}
                    {isWinner && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-300/20 to-transparent -skew-x-12"
                        initial={{ x: '-100%' }}
                        animate={{ x: '200%' }}
                        transition={{ delay: revealDelay + 0.3, duration: 1, repeat: Infinity, repeatDelay: 2 }}
                      />
                    )}

                    <div className="flex items-center justify-between relative z-10">
                      {/* Placement and player */}
                      <div className="flex items-center gap-4">
                        <PlacementBadge placement={standing.placement} delay={revealDelay} />

                        {/* Player info */}
                        <div>
                          <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: revealDelay + 0.1 }}
                            className={`font-semibold text-xl ${isWinner ? 'text-yellow-100' : 'text-white'}`}
                          >
                            {standing.playerName}
                            {isWinner && (
                              <motion.span
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: revealDelay + 0.5, type: 'spring' }}
                                className="ml-2 text-2xl"
                              >
                                🏆
                              </motion.span>
                            )}
                          </motion.p>
                          {isWinner && (
                            <motion.p
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: revealDelay + 0.3 }}
                              className="text-sm text-yellow-400/80 font-medium"
                            >
                              Winner!
                            </motion.p>
                          )}
                        </div>
                      </div>

                      {/* Total Score */}
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: revealDelay + 0.2, type: 'spring' }}
                        className="text-right"
                      >
                        <motion.p
                          className={`text-3xl font-bold ${isWinner ? 'text-yellow-400' : 'text-green-400'}`}
                          animate={isWinner ? {
                            scale: [1, 1.1, 1],
                            textShadow: [
                              '0 0 10px rgba(251, 191, 36, 0.3)',
                              '0 0 20px rgba(251, 191, 36, 0.6)',
                              '0 0 10px rgba(251, 191, 36, 0.3)',
                            ],
                          } : {}}
                          transition={{ duration: 1.5, repeat: isWinner ? Infinity : 0 }}
                        >
                          <AnimatedScore value={standing.cumulativeScore} delay={(revealDelay + 0.3) * 1000} />
                        </motion.p>
                        <p className="text-xs text-gray-400">total points</p>
                      </motion.div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}

          {/* Loading indicator while revealing final standings */}
          {showFinalStandings && revealedCount < sortedStandings.length && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-6 gap-3"
            >
              <motion.div
                className="flex gap-2"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-3 h-3 rounded-full bg-gold"
                    animate={{
                      y: [0, -10, 0],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.15,
                    }}
                  />
                ))}
              </motion.div>
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-gold/80 text-sm"
              >
                Revealing #{revealedCount + 1}...
              </motion.div>
            </motion.div>
          )}

          {/* Loading indicator while revealing - only for set types */}
          {showSetResults && (
            <AnimatePresence>
              {revealedCount < results.length && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-6 gap-3"
                >
                  <motion.div
                    className="flex gap-2"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-3 h-3 rounded-full bg-crimson"
                        animate={{
                          y: [0, -10, 0],
                          opacity: [0.5, 1, 0.5],
                        }}
                        transition={{
                          duration: 0.6,
                          repeat: Infinity,
                          delay: i * 0.15,
                        }}
                      />
                    ))}
                  </motion.div>
                  <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-crimson/80 text-sm"
                  >
                    Revealing #{revealedCount + 1}...
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Predictions section - shown for round type (and game type if predictions exist) */}
          <AnimatePresence>
            {showPredictions && predictions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: type === 'round' ? 0 : 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className={type === 'round' ? '' : 'mt-6 pt-5 border-t-2 border-crimson/30'}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-center gap-3 mb-5"
                >
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-crimson/50" />
                  <h3 className="text-xl font-bold text-white font-display flex items-center gap-2">
                    <span className="text-2xl">🎯</span>
                    Prediction Results
                  </h3>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-crimson/50" />
                </motion.div>
                <div className="space-y-3">
                  {predictions.map((pred, idx) => (
                    <motion.div
                      key={pred.playerId}
                      initial={{ opacity: 0, x: -30, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{
                        delay: idx * 0.2,
                        type: 'spring',
                        stiffness: 300,
                      }}
                      className={`
                        flex items-center justify-between p-4 rounded-xl relative overflow-hidden
                        ${pred.correct
                          ? 'bg-gradient-to-r from-green-500/25 via-green-500/10 to-transparent border-2 border-green-500/50'
                          : 'bg-gradient-to-r from-red-500/20 via-red-500/5 to-transparent border border-red-500/30'}
                      `}
                    >
                      {/* Shine effect for correct predictions */}
                      {pred.correct && (
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
                          initial={{ x: '-100%' }}
                          animate={{ x: '200%' }}
                          transition={{ delay: idx * 0.2 + 0.5, duration: 0.8 }}
                        />
                      )}
                      <div className="flex items-center gap-4 relative z-10">
                        <PredictionIcon correct={pred.correct} delay={idx * 0.2 + 0.1} />
                        <div>
                          <p className="text-white font-semibold text-lg">{pred.playerName}</p>
                          <p className={`text-sm ${pred.correct ? 'text-green-400' : 'text-gray-400'}`}>
                            Predicted: <span className="font-semibold">{getPredictionInfo(pred.type, playerCount).title}</span>
                          </p>
                        </div>
                      </div>
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: idx * 0.2 + 0.3, type: 'spring' }}
                        className="relative z-10 text-right"
                      >
                        {pred.correct ? (
                          <>
                            <p className="text-2xl font-bold text-green-400">
                              +<AnimatedScore value={pred.bonus} delay={(idx * 0.2 + 0.4) * 1000} />
                            </p>
                            <p className="text-xs text-green-400/70">bonus points</p>
                          </>
                        ) : (
                          <p className="text-gray-500 text-sm italic">No bonus</p>
                        )}
                      </motion.div>
                    </motion.div>
                  ))}
                </div>
                {/* Summary of prediction bonuses */}
                {predictions.some(p => p.correct) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: predictions.length * 0.2 + 0.5 }}
                    className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-center"
                  >
                    <p className="text-green-400 text-sm">
                      <span className="font-bold">{predictions.filter(p => p.correct).length}</span> correct prediction{predictions.filter(p => p.correct).length !== 1 ? 's' : ''} this round!
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700/50 sticky bottom-0 bg-gradient-to-t from-gray-900 to-gray-900/95">
          {hasAcknowledgedResults ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              {/* Waiting indicator */}
              <div className="flex items-center justify-center gap-3 mb-2">
                <motion.div
                  className="flex gap-1.5"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2.5 h-2.5 rounded-full bg-green-500"
                      animate={{
                        y: [0, -6, 0],
                        opacity: [0.5, 1, 0.5],
                      }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        delay: i * 0.15,
                      }}
                    />
                  ))}
                </motion.div>
                <span className="text-green-400 font-medium">
                  Waiting for other players...
                </span>
              </div>
              {/* Progress indicator */}
              <div className="text-sm text-gray-400">
                <span className="text-green-400 font-mono">{acknowledgedCount}</span>
                <span className="mx-1">/</span>
                <span className="font-mono">{totalPlayersCount}</span>
                <span className="ml-1">ready</span>
              </div>
              {/* Show who we're waiting for */}
              {waitingForPlayerIds.length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  Waiting for: {waitingForPlayerIds.map(id => playerNames[id] || 'Unknown').join(', ')}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.button
              type="button"
              onClick={onClose}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(220, 38, 38, 0.3)' }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 bg-gradient-to-r from-crimson to-red-700 hover:from-red-600 hover:to-red-800 text-white font-semibold rounded-xl transition-all shadow-lg"
            >
              Continue
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default ResultsModal;
