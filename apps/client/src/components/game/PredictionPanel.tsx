import { motion, AnimatePresence } from 'framer-motion';
import {
  PredictionType,
  getAvailablePredictions,
  getPredictionInfo,
  PLACEMENT_POINTS_BY_PLAYER_COUNT,
} from '@devilsdice/shared';

interface PredictionPanelProps {
  onSubmit: (type: PredictionType) => void;
  disabled: boolean;
  submitted: boolean;
  selectedPrediction?: PredictionType;
  timeRemaining?: number;
  totalTime?: number;
  playerCount: number;
}

// Color configs for each prediction type
const PREDICTION_COLORS: Record<PredictionType, {
  color: string;
  hoverColor: string;
  borderColor: string;
}> = {
  [PredictionType.ZERO]: {
    color: 'bg-gray-700',
    hoverColor: 'hover:bg-gray-600',
    borderColor: 'border-gray-500',
  },
  [PredictionType.MIN]: {
    color: 'bg-blue-700',
    hoverColor: 'hover:bg-blue-600',
    borderColor: 'border-blue-500',
  },
  [PredictionType.MORE]: {
    color: 'bg-purple-700',
    hoverColor: 'hover:bg-purple-600',
    borderColor: 'border-purple-500',
  },
  [PredictionType.MAX]: {
    color: 'bg-yellow-600',
    hoverColor: 'hover:bg-yellow-500',
    borderColor: 'border-yellow-400',
  },
};

// Reward text for each prediction type
function getRewardText(type: PredictionType): string {
  if (type === PredictionType.ZERO) {
    return '+40 bonus';
  }
  return 'Double your points';
}

// Get ordinal suffix (1st, 2nd, 3rd, etc.)
function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function PredictionPanel({
  onSubmit,
  disabled,
  submitted,
  selectedPrediction,
  timeRemaining,
  totalTime = 30,
  playerCount,
}: PredictionPanelProps) {
  // Get available predictions based on player count
  const availablePredictions = getAvailablePredictions(playerCount);

  // Get placement points for this player count
  const placementPoints = PLACEMENT_POINTS_BY_PLAYER_COUNT[playerCount] || PLACEMENT_POINTS_BY_PLAYER_COUNT[4];

  // Determine grid columns based on number of predictions
  const gridCols = availablePredictions.length === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-4 md:mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
          Make Your Prediction
        </h2>
        <p className="text-gray-400 text-sm md:text-base">
          {playerCount === 2
            ? 'Predict the outcome of this round'
            : 'Predict how many points you will score this round'
          }
        </p>
      </div>

      {/* Placement Points Reference */}
      <div className="mb-4 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
        <div className="text-xs text-gray-400 mb-2 text-center font-medium">Points Per Set</div>
        <div className="flex justify-center gap-3 flex-wrap">
          {Object.entries(placementPoints).map(([place, points]) => (
            <div key={place} className="flex items-center gap-1.5">
              <span className="text-gray-300 text-sm font-medium">{getOrdinal(Number(place))}:</span>
              <span className="text-yellow-400 font-mono font-bold text-sm">{points}</span>
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-500 text-center mt-2">
          Round score = Set 1 + Set 2 (max 12 pts)
        </div>
      </div>

      {/* Timer */}
      {timeRemaining !== undefined && !submitted && (
        <div className="mb-4">
          <div className="flex items-center gap-2 justify-center">
            <span className="text-gray-400 text-sm">Time:</span>
            <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-green-500 to-yellow-500"
                initial={{ width: '100%' }}
                animate={{ width: `${(timeRemaining / totalTime) * 100}%` }}
              />
            </div>
            <span className="text-white font-mono text-sm w-6">{timeRemaining}s</span>
          </div>
        </div>
      )}

      {/* Prediction options grid */}
      <div className={`grid ${gridCols} gap-3 md:gap-4`}>
        {availablePredictions.map((type, idx) => {
          const colors = PREDICTION_COLORS[type];
          const info = getPredictionInfo(type, playerCount);
          const isSelected = selectedPrediction === type;
          const canSelect = !disabled && !submitted;

          return (
            <motion.button
              key={type}
              type="button"
              onClick={() => canSelect && onSubmit(type)}
              disabled={!canSelect}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={canSelect ? { scale: 1.02 } : undefined}
              whileTap={canSelect ? { scale: 0.98 } : undefined}
              className={`
                relative p-4 md:p-6 rounded-xl border-2 text-left
                transition-all duration-200
                ${
                  isSelected
                    ? `${colors.color} ${colors.borderColor} ring-2 ring-offset-2 ring-offset-gray-900`
                    : submitted
                    ? 'bg-gray-800/50 border-gray-700 opacity-50'
                    : `${colors.color} ${colors.borderColor} ${colors.hoverColor}`
                }
                ${canSelect ? 'cursor-pointer' : 'cursor-not-allowed'}
              `}
            >
              {/* Selected indicator */}
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center"
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
              )}

              {/* Title */}
              <h3 className="text-lg md:text-xl font-bold text-white mb-1">
                {info.title}
              </h3>

              {/* Condition - the score range */}
              <p className="text-white/90 text-sm md:text-base mb-2 font-medium">
                {info.condition}
              </p>

              {/* Reward */}
              <div className={`
                inline-block px-2 py-1 rounded text-xs md:text-sm font-semibold
                ${type === PredictionType.ZERO ? 'bg-yellow-500 text-black' : 'bg-green-500/30 text-green-400'}
              `}>
                {getRewardText(type)}
              </div>

              {/* Description (visible on larger screens) */}
              <p className="hidden md:block mt-2 text-xs text-white/60">
                {info.description}
              </p>
            </motion.button>
          );
        })}
      </div>

      {/* Submitted state */}
      <AnimatePresence>
        {submitted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6 text-center"
          >
            <div className="flex items-center justify-center gap-2 text-green-400">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full"
              />
              <span className="font-medium">Waiting for other players...</span>
            </div>
            {selectedPrediction && (
              <p className="text-gray-400 text-sm mt-2">
                You predicted: <span className="text-white font-semibold">
                  {getPredictionInfo(selectedPrediction, playerCount).title}
                </span>
                {' '}
                <span className="text-gray-500">
                  ({getPredictionInfo(selectedPrediction, playerCount).condition})
                </span>
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PredictionPanel;
