import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Player, Die as DieType } from '@devilsdice/shared';
import { DieColor, PredictionType, getPredictionInfo } from '@devilsdice/shared';
import { Die } from '@/components/dice';

// Prediction color config
const PREDICTION_COLORS: Record<PredictionType, { color: string; bgColor: string }> = {
  [PredictionType.ZERO]: { color: 'text-gray-300', bgColor: 'bg-gray-600/50' },
  [PredictionType.MIN]: { color: 'text-blue-300', bgColor: 'bg-blue-600/30' },
  [PredictionType.MORE]: { color: 'text-purple-300', bgColor: 'bg-purple-600/30' },
  [PredictionType.MAX]: { color: 'text-yellow-300', bgColor: 'bg-yellow-600/30' },
};

interface PlayerAreaProps {
  player: Player;
  isCurrentTurn: boolean;
  currentSet: 1 | 2;
  selectionStatus?: 'selecting' | 'confirmed' | null;
  playerCount: number;
  // Self-specific props
  isSelf?: boolean;
  selectedDiceIds?: string[];
  onDieSelect?: (dieId: string) => void;
  canSelectDice?: boolean;
}

export function PlayerArea({
  player,
  isCurrentTurn,
  currentSet: _currentSet, // Prefixed to indicate intentionally unused
  selectionStatus,
  playerCount,
  isSelf = false,
  selectedDiceIds = [],
  onDieSelect,
  canSelectDice = false,
}: PlayerAreaProps) {
  // Separate and group dice (excluding spent and currently selected dice)
  const { whiteDiceByValue, hiddenDice } = useMemo(() => {
    const white: DieType[] = [];
    const hidden: DieType[] = [];

    player.dice.forEach((die) => {
      // Skip spent dice and currently selected dice
      if (die.isSpent) return;
      if (selectedDiceIds.includes(die.id)) return;

      if (die.color === DieColor.WHITE) {
        white.push(die);
      } else {
        hidden.push(die);
      }
    });

    // Group white dice by value (1-6)
    const byValue: Record<number, DieType[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    white.forEach((die) => {
      byValue[die.value].push(die);
    });

    // Sort hidden: red first, then blue
    hidden.sort((a, b) => {
      if (a.color === DieColor.RED && b.color === DieColor.BLUE) return -1;
      if (a.color === DieColor.BLUE && b.color === DieColor.RED) return 1;
      return 0;
    });

    return { whiteDiceByValue: byValue, hiddenDice: hidden };
  }, [player.dice, selectedDiceIds]);

  // Get value groups that have dice
  const valueGroups = [1, 2, 3, 4, 5, 6].filter(
    (val) => whiteDiceByValue[val].length > 0
  );

  const selectedCount = selectedDiceIds.length;
  const canSelectMore = selectedCount < 3;

  // Get the actual selected dice objects
  const selectedDice = useMemo(() => {
    return selectedDiceIds
      .map((id) => player.dice.find((d) => d.id === id))
      .filter((d): d is DieType => d !== undefined);
  }, [selectedDiceIds, player.dice]);

  const handleDieClick = (die: DieType) => {
    if (!isSelf || !onDieSelect || !canSelectDice) return;
    if (die.isSpent) return;

    const isSelected = selectedDiceIds.includes(die.id);
    // Allow deselection always, selection only if under max
    if (isSelected || canSelectMore) {
      onDieSelect(die.id);
    }
  };

  // Border colors based on state
  const getBorderStyle = () => {
    if (isSelf) {
      if (isCurrentTurn) {
        return {
          borderColor: 'rgba(234, 179, 8, 0.8)', // Gold when it's your turn
          boxShadow: '0 0 25px rgba(234, 179, 8, 0.4)',
        };
      }
      return {
        borderColor: 'rgba(234, 179, 8, 0.4)', // Muted gold otherwise
        boxShadow: '0 0 10px rgba(234, 179, 8, 0.2)',
      };
    }
    if (isCurrentTurn) {
      return {
        borderColor: 'rgba(34, 197, 94, 0.7)',
        boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)',
      };
    }
    return {
      borderColor: 'rgba(139, 92, 246, 0.2)',
      boxShadow: 'none',
    };
  };

  return (
    <motion.div
      animate={getBorderStyle()}
      transition={{ duration: 0.3 }}
      className={`
        backdrop-blur rounded-xl p-3 md:p-4
        border-2 transition-colors flex flex-col
        ${isSelf ? 'bg-yellow-900/20' : 'bg-gray-800/50'}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`font-semibold text-sm md:text-base truncate max-w-24 md:max-w-32 ${isSelf ? 'text-yellow-100' : 'text-white'}`}>
            {isSelf ? `${player.name} (You)` : player.name}
          </span>
          {!player.isConnected && (
            <span className="w-2 h-2 rounded-full bg-red-500" title="Disconnected" />
          )}
          {isCurrentTurn && (
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className={`w-2 h-2 rounded-full ${isSelf ? 'bg-yellow-400' : 'bg-green-500'}`}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Show prediction badge for self only - with score range */}
          {isSelf && player.prediction && (
            <span
              className={`
                text-xs px-2 py-0.5 rounded-full font-medium
                ${PREDICTION_COLORS[player.prediction].bgColor}
                ${PREDICTION_COLORS[player.prediction].color}
              `}
              title="Your prediction for this round"
            >
              {getPredictionInfo(player.prediction, playerCount).title}
              {' '}
              <span className="opacity-75">
                ({getPredictionInfo(player.prediction, playerCount).condition})
              </span>
            </span>
          )}
          <div className="text-right">
            <span className="text-yellow-400 font-mono font-bold text-sm">
              {(player.set1Score + player.set2Score).toFixed(1)}
            </span>
            <span className="text-gray-500 text-xs block">round</span>
          </div>
        </div>
      </div>

      {/* Selection status */}
      {selectionStatus && (
        <div className="mb-2">
          <span className={`
            text-xs px-2 py-0.5 rounded-full
            ${selectionStatus === 'confirmed'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-yellow-500/20 text-yellow-400'
            }
          `}>
            {selectionStatus === 'confirmed' ? 'Confirmed' : 'Selecting...'}
          </span>
          {isSelf && canSelectDice && selectionStatus !== 'confirmed' && (
            <span className="text-xs text-gray-400 ml-2">
              {selectedCount}/3 selected
            </span>
          )}
        </div>
      )}

      {/* Instruction banner when it's your turn to select */}
      {isSelf && canSelectDice && selectionStatus !== 'confirmed' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 px-3 py-2 rounded-lg bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30"
        >
          <div className="flex items-center justify-center gap-2 text-yellow-200">
            <motion.span
              animate={{ y: [0, 3, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
              className="text-lg"
            >
              👆
            </motion.span>
            <span className="text-sm font-medium">
              Click {3 - selectedCount} dice below to select your hand
            </span>
          </div>
        </motion.div>
      )}

      {/* Dice display - grouped by value with hidden on side */}
      <motion.div
        animate={isSelf && canSelectDice && canSelectMore ? {
          boxShadow: [
            '0 0 0 0 rgba(234, 179, 8, 0)',
            '0 0 0 4px rgba(234, 179, 8, 0.2)',
            '0 0 0 0 rgba(234, 179, 8, 0)',
          ],
        } : { boxShadow: '0 0 0 0 rgba(234, 179, 8, 0)' }}
        transition={isSelf && canSelectDice && canSelectMore
          ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.2 }
        }
        className={`
          flex-1 flex items-center justify-center p-2 rounded-lg
          ${isSelf && canSelectDice && canSelectMore ? 'bg-yellow-500/5 cursor-pointer' : ''}
        `}
      >
        {/* Scaling wrapper - scales down when PlayerArea is narrow (accounts for sidebar) */}
        <div className="flex items-start justify-center gap-3 max-[640px]:scale-[0.85] max-[480px]:scale-[0.75] max-[380px]:scale-[0.65] origin-center">
          {/* White dice - grouped by value, stacked */}
          <div className="flex gap-2 flex-nowrap">
            {valueGroups.map((value) => (
              <div key={value} className="flex flex-col gap-1">
                {whiteDiceByValue[value].map((die) => (
                  <Die
                    key={die.id}
                    die={die}
                    size="md"
                    isSelectable={isSelf && canSelectDice && canSelectMore}
                    onClick={() => handleDieClick(die)}
                    forceReveal={isSelf}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Hidden dice on the side */}
          {hiddenDice.length > 0 && (
            <>
              <div className="self-stretch w-px bg-gray-600/50" />
              <div className="flex flex-col gap-1">
                {hiddenDice.map((die) => (
                  <Die
                    key={die.id}
                    die={isSelf ? die : { ...die, isRevealed: false }}
                    size="md"
                    isSelectable={isSelf && canSelectDice && canSelectMore}
                    onClick={() => handleDieClick(die)}
                    forceReveal={isSelf}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Selected dice display - shows when selecting or has selections */}
      <AnimatePresence>
        {((isSelf && canSelectDice) || selectedDice.length > 0) && selectionStatus && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-gray-600/50"
          >
            <div className="text-xs text-gray-400 mb-2 text-center">
              {isSelf ? 'Your Selection' : 'Selection'} ({selectedDice.length}/3)
            </div>
            <div className="flex justify-center gap-2">
              {selectedDice.map((die) => (
                <motion.div
                  key={die.id}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <Die
                    die={die}
                    size="md"
                    forceReveal={isSelf}
                    isSelectable={isSelf && canSelectDice}
                    onClick={() => isSelf && onDieSelect && onDieSelect(die.id)}
                  />
                </motion.div>
              ))}
              {/* Empty slots for remaining selections */}
              {Array.from({ length: 3 - selectedDice.length }).map((_, idx) => (
                <motion.div
                  key={`empty-${idx}`}
                  animate={isSelf && canSelectDice ? {
                    borderColor: ['rgba(234, 179, 8, 0.3)', 'rgba(234, 179, 8, 0.6)', 'rgba(234, 179, 8, 0.3)'],
                  } : { borderColor: 'rgba(75, 85, 99, 0.5)' }}
                  transition={isSelf && canSelectDice
                    ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: idx * 0.2 }
                    : { duration: 0.2 }
                  }
                  className="w-14 h-14 md:w-16 md:h-16 rounded-xl border-2 border-dashed flex items-center justify-center"
                  style={{ backgroundColor: isSelf && canSelectDice ? 'rgba(234, 179, 8, 0.05)' : 'transparent' }}
                >
                  <span className={`text-xl ${isSelf && canSelectDice ? 'text-yellow-500/60' : 'text-gray-600'}`}>+</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Set scores - always at bottom */}
      <div className="mt-auto pt-3 border-t border-gray-700/50 flex justify-between text-xs">
        <span className="text-gray-400">
          Set 1: <span className="text-white font-mono">{player.set1Score.toFixed(1)}</span>
        </span>
        <span className="text-gray-400">
          Set 2: <span className="text-white font-mono">{player.set2Score.toFixed(1)}</span>
        </span>
      </div>
    </motion.div>
  );
}

export default PlayerArea;
