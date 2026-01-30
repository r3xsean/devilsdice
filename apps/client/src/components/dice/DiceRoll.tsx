import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Die as DieType } from '@devilsdice/shared';
import { DieColor } from '@devilsdice/shared';
import { Die } from './Die';

interface DiceRollProps {
  dice: DieType[];
  onComplete?: () => void;
  duration?: number; // Total animation duration in ms
}

// Temporary die with random value for rolling animation
interface RollingDie extends Omit<DieType, 'value'> {
  value: number;
  isRolling: boolean;
  showFlash: boolean;
}

const getRandomValue = (): number => Math.floor(Math.random() * 6) + 1;

const getDieStyles = (color: DieColor) => {
  switch (color) {
    case DieColor.WHITE:
      return {
        background: 'bg-white',
        border: 'border-gray-300',
        text: 'text-gray-900',
        glow: 'shadow-white/50',
      };
    case DieColor.RED:
      return {
        background: 'bg-red-600',
        border: 'border-red-700',
        text: 'text-white',
        glow: 'shadow-red-500/50',
      };
    case DieColor.BLUE:
      return {
        background: 'bg-blue-600',
        border: 'border-blue-700',
        text: 'text-white',
        glow: 'shadow-blue-500/50',
      };
    default:
      return {
        background: 'bg-white',
        border: 'border-gray-300',
        text: 'text-gray-900',
        glow: 'shadow-white/50',
      };
  }
};

// Initialize dice with rolling state outside component to avoid lint errors
const initializeRollingDice = (dice: DieType[]): RollingDie[] =>
  dice.map((die) => ({
    ...die,
    value: getRandomValue(),
    isRolling: true,
    showFlash: false,
  }));

// Tumble keyframes for realistic dice shake
const tumbleVariants = {
  rolling: {
    rotateX: [0, 15, -10, 20, -15, 10, 0],
    rotateY: [0, -20, 15, -25, 20, -10, 0],
    rotateZ: [0, 10, -15, 12, -8, 5, 0],
    x: [0, -8, 12, -10, 8, -5, 0],
    y: [0, -15, 5, -20, 10, -8, 0],
    scale: [1, 1.05, 0.98, 1.08, 0.95, 1.02, 1],
    transition: {
      duration: 0.4,
      repeat: Infinity,
      repeatType: 'loop' as const,
      ease: 'easeInOut' as const,
    },
  },
  revealed: {
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    x: 0,
    y: 0,
    scale: [1.3, 0.9, 1.1, 0.95, 1],
    transition: {
      scale: {
        duration: 0.5,
        times: [0, 0.3, 0.5, 0.7, 1],
        ease: 'easeOut' as const,
      },
      default: {
        type: 'spring' as const,
        stiffness: 400,
        damping: 20,
      },
    },
  },
};

export function DiceRoll({ dice, onComplete, duration = 2000 }: DiceRollProps) {
  // Initialize with dice data using lazy initialization
  const [rollingDice, setRollingDice] = useState<RollingDie[]>(() =>
    initializeRollingDice(dice)
  );
  const [phase, setPhase] = useState<'rolling' | 'revealing' | 'complete'>('rolling');
  const [shakeIntensity, setShakeIntensity] = useState(1);

  // Track if animation has started to prevent re-runs
  const animationStarted = useRef(false);

  // Store onComplete in ref to avoid dependency issues
  const onCompleteRef = useRef(onComplete);

  // Keep ref in sync with prop using effect
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Animation effect - only runs once on mount
  useEffect(() => {
    if (animationStarted.current) return;
    animationStarted.current = true;

    // Rolling phase - rapidly change values with decreasing speed
    let rollSpeed = 50;
    let rollInterval: ReturnType<typeof setTimeout>;

    const updateRoll = () => {
      setRollingDice((prev) =>
        prev.map((die) =>
          die.isRolling ? { ...die, value: getRandomValue() } : die
        )
      );
      rollSpeed = Math.min(rollSpeed + 5, 150); // Gradually slow down
      setShakeIntensity(Math.max(0.3, 1 - rollSpeed / 200));
      rollInterval = setTimeout(updateRoll, rollSpeed);
    };

    rollInterval = setTimeout(updateRoll, rollSpeed);

    // Start revealing phase after initial roll duration
    const revealTimeout = setTimeout(() => {
      setPhase('revealing');
      clearTimeout(rollInterval);

      // Stagger reveal each die with dramatic effect
      dice.forEach((die, idx) => {
        setTimeout(() => {
          setRollingDice((prev) =>
            prev.map((d) =>
              d.id === die.id
                ? { ...d, value: die.value, isRolling: false, showFlash: true }
                : d
            )
          );
          // Clear flash after animation
          setTimeout(() => {
            setRollingDice((prev) =>
              prev.map((d) =>
                d.id === die.id ? { ...d, showFlash: false } : d
              )
            );
          }, 400);
        }, idx * 300); // 300ms stagger between each reveal
      });

      // Complete after all dice revealed
      setTimeout(() => {
        setPhase('complete');
        onCompleteRef.current?.();
      }, dice.length * 300 + 500);
    }, duration * 0.6); // Use 60% of duration for rolling

    return () => {
      clearTimeout(rollInterval);
      clearTimeout(revealTimeout);
    };
  }, [dice, duration]);

  const getRotation = useCallback(() => {
    return (Math.random() * 360 - 180) * shakeIntensity;
  }, [shakeIntensity]);

  return (
    <div className="space-y-6">
      {/* Title with pulse effect during rolling */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <motion.h3
          className="text-xl font-bold text-white font-display"
          animate={phase === 'rolling' ? {
            textShadow: [
              '0 0 10px rgba(220, 38, 38, 0.5)',
              '0 0 20px rgba(220, 38, 38, 0.8)',
              '0 0 10px rgba(220, 38, 38, 0.5)',
            ],
          } : {
            textShadow: phase === 'complete'
              ? '0 0 20px rgba(34, 197, 94, 0.6)'
              : '0 0 10px rgba(250, 204, 21, 0.5)',
          }}
          transition={{ duration: 0.5, repeat: phase === 'rolling' ? Infinity : 0 }}
        >
          {phase === 'rolling' && 'Rolling dice...'}
          {phase === 'revealing' && 'Revealing...'}
          {phase === 'complete' && 'Roll complete!'}
        </motion.h3>
      </motion.div>

      {/* Dice display with table surface effect */}
      <div className="relative py-8">
        {/* Table surface glow */}
        <motion.div
          className="absolute inset-0 rounded-2xl"
          animate={{
            background: phase === 'rolling'
              ? 'radial-gradient(ellipse at center, rgba(220, 38, 38, 0.1) 0%, transparent 70%)'
              : phase === 'complete'
              ? 'radial-gradient(ellipse at center, rgba(34, 197, 94, 0.1) 0%, transparent 70%)'
              : 'radial-gradient(ellipse at center, rgba(250, 204, 21, 0.15) 0%, transparent 70%)',
          }}
          transition={{ duration: 0.3 }}
        />

        <div className="flex flex-wrap justify-center gap-4 md:gap-6 relative z-10">
          <AnimatePresence mode="popLayout">
            {rollingDice.map((die, idx) => {
              const styles = getDieStyles(die.color);

              return (
                <motion.div
                  key={die.id}
                  initial={{ opacity: 0, scale: 0, y: -100, rotateX: 180 }}
                  animate={die.isRolling ? 'rolling' : 'revealed'}
                  variants={tumbleVariants}
                  className="relative"
                  style={{ perspective: 1000 }}
                >
                  {/* Shadow under dice */}
                  <motion.div
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-10 h-3 rounded-full bg-black/30 blur-sm"
                    animate={{
                      width: die.isRolling ? [40, 50, 35, 45, 40] : 40,
                      opacity: die.isRolling ? [0.3, 0.5, 0.2, 0.4, 0.3] : 0.4,
                    }}
                    transition={{
                      duration: 0.4,
                      repeat: die.isRolling ? Infinity : 0,
                    }}
                  />

                  {/* Rolling state - show number with tumble effect */}
                  {die.isRolling ? (
                    <motion.div
                      className={`
                        w-14 h-14 md:w-16 md:h-16
                        rounded-xl
                        border-2
                        shadow-lg
                        flex items-center justify-center
                        ${styles.background}
                        ${styles.border}
                        transform-gpu
                      `}
                      animate={{
                        boxShadow: [
                          `0 4px 6px rgba(0,0,0,0.1), 0 0 0 rgba(255,255,255,0)`,
                          `0 15px 30px rgba(0,0,0,0.4), 0 0 15px rgba(255,255,255,0.3)`,
                          `0 4px 6px rgba(0,0,0,0.1), 0 0 0 rgba(255,255,255,0)`,
                        ],
                        rotate: getRotation(),
                      }}
                      transition={{
                        boxShadow: { duration: 0.3, repeat: Infinity },
                        rotate: { duration: 0.1 },
                      }}
                    >
                      <motion.span
                        className={`text-2xl md:text-3xl font-bold ${styles.text}`}
                        animate={{ opacity: [1, 0.7, 1] }}
                        transition={{ duration: 0.1, repeat: Infinity }}
                      >
                        {die.value}
                      </motion.span>
                    </motion.div>
                  ) : (
                    // Revealed state - show actual Die component with bounce
                    <motion.div
                      initial={{ scale: 1.5, rotateY: -180 }}
                      animate={{ scale: 1, rotateY: 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 15,
                        delay: idx * 0.05,
                      }}
                      className="relative"
                    >
                      <Die
                        die={{
                          ...die,
                          isRevealed: true,
                        }}
                        isSelected={false}
                        isSelectable={false}
                      />

                      {/* Multi-layer reveal flash effect */}
                      <AnimatePresence>
                        {die.showFlash && (
                          <>
                            {/* Inner bright flash */}
                            <motion.div
                              initial={{ opacity: 1, scale: 0.8 }}
                              animate={{ opacity: 0, scale: 1.5 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.4, ease: 'easeOut' }}
                              className="absolute inset-0 bg-yellow-300 rounded-xl pointer-events-none"
                            />
                            {/* Outer glow ring */}
                            <motion.div
                              initial={{ opacity: 0.8, scale: 1 }}
                              animate={{ opacity: 0, scale: 2 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.5, ease: 'easeOut' }}
                              className="absolute inset-0 border-4 border-yellow-400 rounded-xl pointer-events-none"
                            />
                            {/* Radial pulse */}
                            <motion.div
                              initial={{ opacity: 0.6 }}
                              animate={{ opacity: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="absolute -inset-4 bg-gradient-radial from-yellow-400/40 to-transparent rounded-2xl pointer-events-none"
                            />
                          </>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Enhanced progress indicator */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-3">
          {dice.map((die, idx) => {
            const isRevealed = rollingDice[idx]?.isRolling === false;
            return (
              <motion.div
                key={die.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  backgroundColor: isRevealed ? '#22c55e' : '#4b5563',
                }}
                transition={{ delay: idx * 0.1 }}
                className="relative"
              >
                <motion.div
                  className="w-3 h-3 rounded-full"
                  animate={isRevealed ? {
                    boxShadow: '0 0 10px rgba(34, 197, 94, 0.6)',
                  } : {
                    boxShadow: '0 0 0 rgba(0, 0, 0, 0)',
                  }}
                  style={{ backgroundColor: isRevealed ? '#22c55e' : '#4b5563' }}
                />
                {isRevealed && (
                  <motion.div
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0 bg-green-400 rounded-full"
                  />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Roll count indicator */}
        <motion.div
          className="text-xs text-gray-500"
          animate={{ opacity: phase === 'rolling' ? [0.5, 1, 0.5] : 1 }}
          transition={{ duration: 0.5, repeat: phase === 'rolling' ? Infinity : 0 }}
        >
          {phase === 'rolling' && `Rolling ${dice.length} dice...`}
          {phase === 'revealing' && `${rollingDice.filter(d => !d.isRolling).length}/${dice.length} revealed`}
          {phase === 'complete' && 'All dice revealed!'}
        </motion.div>
      </div>
    </div>
  );
}

export default DiceRoll;
