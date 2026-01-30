import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Die as DieType } from '@devilsdice/shared';
import { DieColor } from '@devilsdice/shared';
import { Die } from './Die';

interface DicePoolProps {
  dice: DieType[];
  selectedIds: string[];
  onDieClick: (die: DieType) => void;
  maxSelectable: number;
  disabled?: boolean;
  showHeader?: boolean;
}

export function DicePool({
  dice,
  selectedIds,
  onDieClick,
  maxSelectable,
  disabled = false,
  showHeader = true,
}: DicePoolProps) {
  // Separate white dice from hidden dice and group white by value
  const { whiteDiceByValue, hiddenDice } = useMemo(() => {
    const white: DieType[] = [];
    const hidden: DieType[] = [];

    dice.forEach((die) => {
      if (die.isSpent) return; // Skip spent dice
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

    // Sort hidden dice: red first, then blue
    hidden.sort((a, b) => {
      if (a.color === DieColor.RED && b.color === DieColor.BLUE) return -1;
      if (a.color === DieColor.BLUE && b.color === DieColor.RED) return 1;
      return 0;
    });

    return { whiteDiceByValue: byValue, hiddenDice: hidden };
  }, [dice]);

  const selectedCount = selectedIds.length;
  const canSelectMore = selectedCount < maxSelectable;

  const handleDieClick = (die: DieType) => {
    if (disabled) return;
    if (die.isSpent) return;

    const isCurrentlySelected = selectedIds.includes(die.id);

    // Allow deselection always, but only allow selection if under max
    if (isCurrentlySelected || canSelectMore) {
      onDieClick(die);
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.03,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, scale: 0.8 },
    show: { opacity: 1, scale: 1 },
  };

  // Get all value groups that have dice
  const valueGroups = [1, 2, 3, 4, 5, 6].filter(
    (val) => whiteDiceByValue[val].length > 0
  );

  return (
    <div className="space-y-4">
      {/* Selection counter */}
      {showHeader && maxSelectable > 0 && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-[var(--color-pewter)]">Select {maxSelectable} dice</span>
          <span className={`text-sm font-mono ${selectedCount === maxSelectable ? 'text-[var(--color-emerald)]' : 'text-[var(--color-silver)]'}`}>
            {selectedCount}/{maxSelectable}
          </span>
        </div>
      )}

      {/* Dice layout: White dice grouped by value + Hidden dice on side */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex items-start justify-center gap-6"
      >
        {/* White dice - grouped by value, stacked vertically */}
        <div className="flex gap-2 md:gap-3 flex-wrap">
          {valueGroups.map((value) => (
            <div key={value} className="flex flex-col gap-1.5">
              {whiteDiceByValue[value].map((die) => {
                const isSelected = selectedIds.includes(die.id);
                const isSelectable = !disabled && !die.isSpent && (isSelected || canSelectMore);

                return (
                  <motion.div key={die.id} variants={item}>
                    <Die
                      die={die}
                      isSelected={isSelected}
                      isSelectable={isSelectable}
                      onClick={() => handleDieClick(die)}
                      size="md"
                      forceReveal={true}
                    />
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Hidden dice (Red/Blue) - on the side */}
        {hiddenDice.length > 0 && (
          <>
            {/* Vertical separator */}
            <div className="self-stretch w-px bg-[var(--color-ruby)]/30" />

            <div className="flex flex-col gap-1.5">
              {hiddenDice.map((die) => {
                const isSelected = selectedIds.includes(die.id);
                const isSelectable = !disabled && !die.isSpent && (isSelected || canSelectMore);

                return (
                  <motion.div key={die.id} variants={item}>
                    <Die
                      die={die}
                      isSelected={isSelected}
                      isSelectable={isSelectable}
                      onClick={() => handleDieClick(die)}
                      size="md"
                      forceReveal={true}
                    />
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </motion.div>

      {/* Empty state */}
      {dice.length === 0 && (
        <div className="text-center py-8 text-[var(--color-slate)]">
          No dice available
        </div>
      )}
    </div>
  );
}

export default DicePool;
