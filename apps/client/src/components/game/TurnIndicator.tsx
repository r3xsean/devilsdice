import { motion, AnimatePresence } from 'framer-motion';

interface TurnIndicatorProps {
  currentPlayerName: string;
  timeRemaining: number;
  isYourTurn: boolean;
  totalTime: number;
}

export function TurnIndicator({
  currentPlayerName,
  timeRemaining,
  isYourTurn,
  totalTime,
}: TurnIndicatorProps) {
  const progress = totalTime > 0 ? timeRemaining / totalTime : 1;
  const isUrgent = timeRemaining <= 10;

  // SVG circle properties
  const size = 60;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="flex items-center gap-3 md:gap-4">
      {/* Circular timer */}
      <div className="relative">
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-gray-700"
          />
          {/* Progress circle */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{
              strokeDashoffset,
              color: isUrgent ? '#ef4444' : isYourTurn ? '#22c55e' : '#a855f7',
            }}
            transition={{ duration: 0.3 }}
            className={isUrgent ? 'text-red-500' : isYourTurn ? 'text-green-500' : 'text-purple-500'}
          />
        </svg>
        {/* Timer text */}
        <motion.div
          className={`
            absolute inset-0 flex items-center justify-center
            font-mono font-bold text-lg
            ${isUrgent ? 'text-red-400' : 'text-white'}
          `}
          animate={isUrgent ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.5, repeat: isUrgent ? Infinity : 0 }}
        >
          {timeRemaining}
        </motion.div>
      </div>

      {/* Turn info */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          {isYourTurn ? (
            <motion.div
              key="your-turn"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="space-y-1"
            >
              <motion.p
                className="text-green-400 font-bold text-lg md:text-xl"
                animate={{
                  color: ['#4ade80', '#22c55e', '#4ade80'],
                  textShadow: [
                    '0 0 8px rgba(74, 222, 128, 0.5)',
                    '0 0 16px rgba(74, 222, 128, 0.8)',
                    '0 0 8px rgba(74, 222, 128, 0.5)',
                  ],
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                YOUR TURN!
              </motion.p>
              <p className="text-gray-400 text-sm truncate">
                Select your dice
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="space-y-1"
            >
              <p className="text-gray-400 text-sm">Waiting for</p>
              <p className="text-white font-semibold text-lg truncate">
                {currentPlayerName}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Urgent warning */}
      <AnimatePresence>
        {isUrgent && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/50 rounded-lg"
          >
            <motion.div
              className="w-2 h-2 rounded-full bg-red-500"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
            <span className="text-red-400 text-sm font-medium">Hurry!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TurnIndicator;
