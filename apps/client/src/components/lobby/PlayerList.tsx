import { motion, AnimatePresence } from 'framer-motion';
import type { Player } from '@devilsdice/shared';

interface PlayerListProps {
  players: Player[];
  hostId: string;
  currentPlayerId: string;
  maxPlayers?: number;
}

export function PlayerList({ players, hostId, currentPlayerId, maxPlayers = 6 }: PlayerListProps) {
  const emptySlots = maxPlayers - players.length;

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {players.map((player) => (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, x: -20, height: 0 }}
            animate={{ opacity: 1, x: 0, height: 'auto' }}
            exit={{ opacity: 0, x: 20, height: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex items-center justify-between p-3 rounded-lg ${
              player.id === currentPlayerId
                ? 'bg-purple-600/30 border border-purple-500/50'
                : 'bg-gray-700/30'
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Connection status indicator */}
              <div
                className={`w-3 h-3 rounded-full ${
                  player.isConnected ? 'bg-green-500' : 'bg-gray-500'
                }`}
                title={player.isConnected ? 'Connected' : 'Disconnected'}
              />

              <span className="text-white font-medium flex items-center gap-2">
                {/* Crown icon for host */}
                {player.id === hostId && (
                  <span className="text-yellow-400" title="Host">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5"
                    >
                      <path d="M12 1L9 10L2 8L5 18H19L22 8L15 10L12 1Z" />
                      <path d="M5 20H19V22H5V20Z" />
                    </svg>
                  </span>
                )}

                {player.name}

                {/* You label */}
                {player.id === currentPlayerId && (
                  <span className="text-xs text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded">
                    You
                  </span>
                )}
              </span>
            </div>

            {/* Ready status */}
            <div className="flex items-center gap-2">
              {player.isReady ? (
                <span className="flex items-center gap-1 text-green-400 text-sm font-medium">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      fillRule="evenodd"
                      d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Ready
                </span>
              ) : (
                <span className="flex items-center gap-1 text-gray-400 text-sm">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Not Ready
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Empty slots */}
      {Array.from({ length: emptySlots }).map((_, i) => (
        <motion.div
          key={`empty-${i}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center p-3 rounded-lg bg-gray-700/10 border border-dashed border-gray-600"
        >
          <span className="text-gray-500 text-sm">Waiting for player...</span>
        </motion.div>
      ))}
    </div>
  );
}
