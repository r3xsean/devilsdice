import { motion } from 'framer-motion';
import { GamePhase } from '@devilsdice/shared';

interface PhaseIndicatorProps {
  phase: GamePhase;
  currentSet: 1 | 2;
  currentRound: number;
}

const PHASE_STEPS = [
  { key: 'predict', label: 'Predict', phases: [GamePhase.PREDICTION] },
  { key: 'set1', label: 'Set 1', phases: [GamePhase.SET_SELECTION, GamePhase.SET_REVEAL] },
  { key: 'set2', label: 'Set 2', phases: [GamePhase.SET_SELECTION, GamePhase.SET_REVEAL] },
  { key: 'results', label: 'Results', phases: [GamePhase.ROUND_SUMMARY] },
];

function getPhaseIndex(phase: GamePhase, currentSet: 1 | 2): number {
  if (phase === GamePhase.PREDICTION) return 0;
  if (phase === GamePhase.SET_SELECTION || phase === GamePhase.SET_REVEAL) {
    return currentSet === 1 ? 1 : 2;
  }
  if (phase === GamePhase.ROUND_SUMMARY) return 3;
  return -1;
}

export function PhaseIndicator({ phase, currentSet, currentRound }: PhaseIndicatorProps) {
  const currentIndex = getPhaseIndex(phase, currentSet);

  return (
    <div className="w-full px-2 md:px-4">
      {/* Round indicator */}
      <div className="text-center mb-2">
        <span className="text-xs md:text-sm text-gray-400 font-medium">
          Round {currentRound}
        </span>
      </div>

      {/* Phase steps */}
      <div className="flex items-center justify-center gap-1 md:gap-2">
        {PHASE_STEPS.map((step, idx) => {
          const isActive = idx === currentIndex;
          const isCompleted = idx < currentIndex;

          return (
            <div key={step.key} className="flex items-center">
              {/* Step indicator */}
              <motion.div
                animate={{
                  scale: isActive ? 1.1 : 1,
                }}
                className={`
                  relative flex items-center justify-center
                  w-6 h-6 md:w-8 md:h-8
                  rounded-full
                  text-xs md:text-sm font-semibold
                  transition-colors duration-300
                  ${
                    isActive
                      ? 'bg-purple-600 text-white ring-2 ring-purple-400 ring-offset-2 ring-offset-gray-900'
                      : isCompleted
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-400'
                  }
                `}
              >
                {isCompleted ? (
                  <svg
                    className="w-3 h-3 md:w-4 md:h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  idx + 1
                )}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-purple-500"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </motion.div>

              {/* Step label */}
              <span
                className={`
                  hidden sm:inline ml-1 md:ml-2 text-xs md:text-sm font-medium
                  ${
                    isActive
                      ? 'text-white'
                      : isCompleted
                      ? 'text-green-400'
                      : 'text-gray-500'
                  }
                `}
              >
                {step.label}
              </span>

              {/* Connector line */}
              {idx < PHASE_STEPS.length - 1 && (
                <div
                  className={`
                    w-4 md:w-8 h-0.5 mx-1 md:mx-2
                    ${idx < currentIndex ? 'bg-green-600' : 'bg-gray-700'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PhaseIndicator;
