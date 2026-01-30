import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Player, Die as DieType } from '@devilsdice/shared';
import { DieColor } from '@devilsdice/shared';
import { Die } from '@/components/dice';

interface OpponentAreaProps {
  player: Player;
  isCurrentTurn: boolean;
  currentSet: 1 | 2;
  selectionStatus?: 'selecting' | 'confirmed' | null;
  visibleDice?: DieType[];
  hiddenDiceCount?: number;
}

export function OpponentArea({
  player,
  isCurrentTurn,
  currentSet,
  selectionStatus,
  visibleDice = [],
  hiddenDiceCount = 2,
}: OpponentAreaProps) {
  // Separate and group dice
  const { whiteDiceByValue, hiddenDice } = useMemo(() => {
    const white: DieType[] = [];
    const hidden: DieType[] = [];

    player.dice.forEach((die) => {
      if (die.isSpent) return;
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
  }, [player.dice]);

  // Get value groups that have dice
  const valueGroups = [1, 2, 3, 4, 5, 6].filter(
    (val) => whiteDiceByValue[val].length > 0
  );

  return (
    <motion.div
      animate={{
        borderColor: isCurrentTurn ? 'rgba(34, 197, 94, 0.7)' : 'rgba(139, 92, 246, 0.2)',
        boxShadow: isCurrentTurn ? '0 0 20px rgba(34, 197, 94, 0.3)' : 'none',
      }}
      transition={{ duration: 0.3 }}
      className={`
        bg-gray-800/50 backdrop-blur rounded-xl p-3 md:p-4
        border-2 transition-colors
        ${isCurrentTurn ? 'border-green-500/70' : 'border-purple-500/20'}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white text-sm md:text-base truncate max-w-24 md:max-w-32">
            {player.name}
          </span>
          {!player.isConnected && (
            <span className="w-2 h-2 rounded-full bg-red-500" title="Disconnected" />
          )}
          {isCurrentTurn && (
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-green-500"
            />
          )}
        </div>
        <span className="text-yellow-400 font-mono font-bold text-sm">
          {player.cumulativeScore.toFixed(1)}
        </span>
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
        </div>
      )}

      {/* Dice display - grouped by value with hidden on side */}
      <div className="flex items-start justify-center gap-3">
        {/* White dice - grouped by value, stacked */}
        <div className="flex gap-1 flex-wrap">
          {valueGroups.map((value) => (
            <div key={value} className="flex flex-col gap-0.5">
              {whiteDiceByValue[value].map((die) => (
                <Die
                  key={die.id}
                  die={die}
                  size="sm"
                  isSelectable={false}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Hidden dice on the side */}
        {hiddenDice.length > 0 && (
          <>
            <div className="self-stretch w-px bg-gray-600/50" />
            <div className="flex flex-col gap-0.5">
              {hiddenDice.map((die) => (
                <Die
                  key={die.id}
                  die={{ ...die, isRevealed: false }}
                  size="sm"
                  isSelectable={false}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Visible selected dice from server */}
      {visibleDice.length > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-700">
          <span className="text-xs text-gray-400 block mb-1 text-center">Set {currentSet} selection:</span>
          <div className="flex justify-center gap-1">
            {visibleDice.map((die) => (
              <Die
                key={die.id}
                die={die}
                size="sm"
                isSelectable={false}
              />
            ))}
            {/* Show hidden count placeholders */}
            {Array.from({ length: hiddenDiceCount }).map((_, idx) => (
              <Die
                key={`hidden-${idx}`}
                die={{ id: `hidden-${idx}`, color: DieColor.RED, value: 1, isSpent: false, isRevealed: false }}
                size="sm"
                isSelectable={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Set scores */}
      <div className="mt-3 pt-2 border-t border-gray-700/50 flex justify-between text-xs">
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

export default OpponentArea;
