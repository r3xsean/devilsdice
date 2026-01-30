import { motion } from 'framer-motion';
import type { Die as DieType } from '@devilsdice/shared';
import { DieColor } from '@devilsdice/shared';

interface DieProps {
  die: DieType;
  isSelected?: boolean;
  isSelectable?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  forceReveal?: boolean; // Show value even if die.isRevealed is false (for your own dice)
}

// Pip positions for each die face value (1-6)
const pipPositions: Record<number, { top: string; left: string }[]> = {
  1: [{ top: '50%', left: '50%' }],
  2: [
    { top: '25%', left: '75%' },
    { top: '75%', left: '25%' },
  ],
  3: [
    { top: '25%', left: '75%' },
    { top: '50%', left: '50%' },
    { top: '75%', left: '25%' },
  ],
  4: [
    { top: '25%', left: '25%' },
    { top: '25%', left: '75%' },
    { top: '75%', left: '25%' },
    { top: '75%', left: '75%' },
  ],
  5: [
    { top: '25%', left: '25%' },
    { top: '25%', left: '75%' },
    { top: '50%', left: '50%' },
    { top: '75%', left: '25%' },
    { top: '75%', left: '75%' },
  ],
  6: [
    { top: '25%', left: '30%' },
    { top: '50%', left: '30%' },
    { top: '75%', left: '30%' },
    { top: '25%', left: '70%' },
    { top: '50%', left: '70%' },
    { top: '75%', left: '70%' },
  ],
};

// Size configurations
const sizeConfig = {
  sm: { die: 'w-10 h-10', pip: 'w-1.5 h-1.5', inset: 'inset-1.5', text: 'text-lg' },
  md: { die: 'w-14 h-14 md:w-16 md:h-16', pip: 'w-2 h-2 md:w-2.5 md:h-2.5', inset: 'inset-2', text: 'text-2xl md:text-3xl' },
  lg: { die: 'w-18 h-18 md:w-20 md:h-20', pip: 'w-2.5 h-2.5 md:w-3 md:h-3', inset: 'inset-2.5', text: 'text-3xl md:text-4xl' },
};

export function Die({ die, isSelected = false, isSelectable = false, onClick, size = 'md', forceReveal = false }: DieProps) {
  const isHidden = !forceReveal && !die.isRevealed && die.color !== DieColor.WHITE;
  const canInteract = isSelectable && !die.isSpent;
  const config = sizeConfig[size];

  // Get die style class based on color
  const getDieClass = () => {
    switch (die.color) {
      case DieColor.WHITE:
        return 'die-white';
      case DieColor.RED:
        return 'die-red';
      case DieColor.BLUE:
        return 'die-blue';
      default:
        return 'die-white';
    }
  };

  // Get pip style class based on die color
  const getPipClass = () => {
    return die.color === DieColor.WHITE ? 'die-pip-dark' : 'die-pip-light';
  };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!canInteract}
      initial={{ opacity: 0, scale: 0.8, rotateY: 180 }}
      animate={{
        opacity: die.isSpent ? 0.35 : 1,
        scale: 1,
        rotateY: 0,
        filter: die.isSpent ? 'grayscale(100%) brightness(0.7)' : 'grayscale(0%) brightness(1)',
      }}
      whileHover={canInteract ? {
        scale: 1.08,
        y: -4,
        transition: { type: 'spring', stiffness: 400, damping: 15 }
      } : undefined}
      whileTap={canInteract ? { scale: 0.95, y: 0 } : undefined}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 20,
        opacity: { duration: 0.2 },
        filter: { duration: 0.3 },
      }}
      className={`
        relative
        ${config.die}
        rounded-xl
        flex items-center justify-center
        transition-all duration-200
        ${getDieClass()}
        ${isSelected ? 'die-selected' : ''}
        ${die.isSpent ? 'pointer-events-none' : ''}
        ${canInteract ? 'cursor-pointer' : 'cursor-default'}
      `}
      aria-label={`Die ${die.color} value ${die.value}${isSelected ? ' selected' : ''}${die.isSpent ? ' spent' : ''}`}
    >
      {/* Subtle highlight effect on top */}
      <div className="absolute inset-x-2 top-1 h-2 rounded-full bg-white/10 blur-sm" />

      {isHidden ? (
        // Hidden state - show stylized question mark
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`${config.text} font-display font-bold text-white/90 drop-shadow-lg`}
        >
          ?
        </motion.span>
      ) : (
        // Revealed state - show pips
        <div className={`absolute ${config.inset}`}>
          {pipPositions[die.value]?.map((pos, idx) => (
            <motion.div
              key={idx}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                delay: idx * 0.04,
                type: 'spring',
                stiffness: 500,
                damping: 15
              }}
              className={`
                absolute
                ${config.pip}
                rounded-full
                ${getPipClass()}
                -translate-x-1/2 -translate-y-1/2
              `}
              style={{ top: pos.top, left: pos.left }}
            />
          ))}
        </div>
      )}

      {/* Selection glow effect */}
      {isSelected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute -inset-1 rounded-xl bg-[var(--color-gold)]/20 blur-md -z-10"
        />
      )}
    </motion.button>
  );
}

export default Die;
