import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Die as DieType } from '@devilsdice/shared';
import { Die } from './Die';

interface DiceSelectionProps {
  selectedDice: DieType[];
  onRemove: (dieId: string) => void;
  onConfirm: () => void;
  canConfirm: boolean;
  isConfirming?: boolean;
  isDraggingDie?: boolean; // When a die is being dragged from pool
}

const SLOTS_COUNT = 3;

// Spring animation for dice sliding into slots
const slideInVariants = {
  initial: {
    opacity: 0,
    scale: 0.3,
    y: -60,
    x: 0,
    rotate: -45,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    x: 0,
    rotate: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 500,
      damping: 25,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.5,
    y: 30,
    rotate: 15,
    transition: {
      duration: 0.2,
      ease: 'easeIn' as const,
    },
  },
};

// Slot hover effect variants
const slotVariants = {
  empty: {
    scale: 1,
    borderColor: 'rgba(75, 85, 99, 0.6)',
    backgroundColor: 'rgba(31, 41, 55, 0.3)',
  },
  hovering: {
    scale: 1.05,
    borderColor: 'rgba(250, 204, 21, 0.8)',
    backgroundColor: 'rgba(250, 204, 21, 0.1)',
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 20,
    },
  },
  ready: {
    scale: 1,
    borderColor: 'rgba(34, 197, 94, 0.6)',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
};

export function DiceSelection({
  selectedDice,
  onRemove,
  onConfirm,
  canConfirm,
  isConfirming = false,
  isDraggingDie = false,
}: DiceSelectionProps) {
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);

  // Create array of 3 slots, filled with selected dice or null
  const slots = Array.from({ length: SLOTS_COUNT }, (_, idx) => selectedDice[idx] || null);
  const emptySlotCount = SLOTS_COUNT - selectedDice.length;

  return (
    <div className="space-y-4">
      {/* Header with progress indicator */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white font-display">Your Selection</h3>
        <div className="flex items-center justify-center gap-2 mt-1">
          <p className="text-sm text-gray-400">
            {canConfirm ? 'Ready to confirm!' : `Select ${emptySlotCount} more ${emptySlotCount === 1 ? 'die' : 'dice'}`}
          </p>
          {/* Mini progress dots */}
          <div className="flex gap-1">
            {slots.map((slot, idx) => (
              <motion.div
                key={idx}
                className="w-2 h-2 rounded-full"
                animate={{
                  backgroundColor: slot ? '#22c55e' : '#4b5563',
                  scale: slot ? [1, 1.2, 1] : 1,
                }}
                transition={{ duration: 0.2 }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Selection slots with enhanced visuals */}
      <div className="flex justify-center gap-4 md:gap-5">
        {slots.map((die, idx) => {
          const isEmptyAndHovered = !die && hoveredSlot === idx && isDraggingDie;
          const isEmptyAndCanFill = !die && emptySlotCount > 0;

          return (
            <motion.div
              key={idx}
              layout
              className="relative"
              onMouseEnter={() => !die && setHoveredSlot(idx)}
              onMouseLeave={() => setHoveredSlot(null)}
            >
              <AnimatePresence mode="wait">
                {die ? (
                  // Filled slot with die
                  <motion.div
                    key={die.id}
                    variants={slideInVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="relative"
                  >
                    {/* Slot glow effect */}
                    <motion.div
                      className="absolute -inset-2 rounded-2xl bg-gradient-to-b from-gold/20 to-transparent blur-sm -z-10"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    />

                    <Die
                      die={die}
                      isSelected={false}
                      isSelectable={false}
                      forceReveal={true}
                    />

                    {/* Remove button with bounce effect */}
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, scale: 0, rotate: -90 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0 }}
                      transition={{
                        delay: 0.15,
                        type: 'spring',
                        stiffness: 500,
                        damping: 20,
                      }}
                      whileHover={{
                        scale: 1.15,
                        rotate: 90,
                        transition: { duration: 0.2 },
                      }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onRemove(die.id)}
                      className="
                        absolute -top-2 -right-2
                        w-7 h-7
                        bg-gradient-to-br from-red-400 to-red-600
                        hover:from-red-500 hover:to-red-700
                        text-white text-sm font-bold
                        rounded-full
                        flex items-center justify-center
                        shadow-lg shadow-red-500/30
                        transition-colors
                        z-10
                      "
                      aria-label="Remove die"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                        <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
                      </svg>
                    </motion.button>

                    {/* Slot number indicator */}
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-gray-500"
                    >
                      #{idx + 1}
                    </motion.div>
                  </motion.div>
                ) : (
                  // Empty slot with hover effects
                  <motion.div
                    key={`empty-${idx}`}
                    variants={slotVariants}
                    initial="empty"
                    animate={isEmptyAndHovered ? 'hovering' : isEmptyAndCanFill ? 'empty' : 'ready'}
                    className="
                      w-14 h-14 md:w-16 md:h-16
                      rounded-xl
                      border-2 border-dashed
                      flex flex-col items-center justify-center
                      text-gray-500 text-xs
                      relative
                      overflow-hidden
                    "
                  >
                    {/* Pulsing inner glow when hovering with die */}
                    <AnimatePresence>
                      {isEmptyAndHovered && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{
                            opacity: [0.3, 0.6, 0.3],
                            scale: [0.8, 1, 0.8],
                          }}
                          exit={{ opacity: 0, scale: 0 }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="absolute inset-0 bg-gold/20 rounded-lg"
                        />
                      )}
                    </AnimatePresence>

                    {/* Plus icon */}
                    <motion.svg
                      className="w-6 h-6 text-gray-500"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      animate={isEmptyAndHovered ? {
                        rotate: 90,
                        scale: 1.2,
                        color: '#fbbf24',
                      } : {
                        rotate: 0,
                        scale: 1,
                      }}
                    >
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </motion.svg>

                    <span className="text-xs mt-1 hidden md:block">
                      {isEmptyAndHovered ? 'Drop!' : 'Slot ' + (idx + 1)}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Confirm button with enhanced effects */}
      <div className="flex justify-center pt-3">
        <motion.button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm || isConfirming}
          whileHover={canConfirm && !isConfirming ? {
            scale: 1.03,
            boxShadow: '0 0 30px rgba(34, 197, 94, 0.4)',
          } : undefined}
          whileTap={canConfirm && !isConfirming ? { scale: 0.97 } : undefined}
          animate={canConfirm && !isConfirming ? {
            boxShadow: [
              '0 0 10px rgba(34, 197, 94, 0.2)',
              '0 0 25px rgba(34, 197, 94, 0.4)',
              '0 0 10px rgba(34, 197, 94, 0.2)',
            ],
          } : {
            boxShadow: '0 0 0 rgba(0, 0, 0, 0)',
          }}
          transition={{
            boxShadow: {
              duration: 1.5,
              repeat: canConfirm ? Infinity : 0,
              ease: 'easeInOut',
            },
          }}
          className={`
            px-8 py-3
            rounded-xl
            font-semibold
            transition-all duration-200
            flex items-center gap-3
            relative
            overflow-hidden
            ${
              canConfirm
                ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 hover:from-green-600 hover:via-emerald-600 hover:to-green-700 text-white'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {/* Animated shine effect on button */}
          {canConfirm && !isConfirming && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            />
          )}

          {isConfirming ? (
            <>
              <motion.svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </motion.svg>
              <span>Confirmed</span>
            </>
          ) : canConfirm ? (
            <>
              <motion.svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              >
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </motion.svg>
              <span className="relative z-10">Confirm Selection</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              <span>Select {emptySlotCount} more {emptySlotCount === 1 ? 'die' : 'dice'}</span>
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}

export default DiceSelection;
