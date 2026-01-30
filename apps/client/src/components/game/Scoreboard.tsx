import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Player } from '@devilsdice/shared';

interface ScoreboardProps {
  players: Player[];
  currentRound: number;
  totalRounds: number;
  currentPlayerId: string;
  predictionStatus?: Record<string, boolean>;
}

interface RankedPlayer extends Player {
  rank: number;
}

export function Scoreboard({
  players,
  currentRound,
  totalRounds,
  currentPlayerId,
  predictionStatus = {},
}: ScoreboardProps) {
  // Sort and rank players
  const rankedPlayers = useMemo(() => {
    const sorted = [...players].sort((a, b) => b.cumulativeScore - a.cumulativeScore);
    let rank = 1;
    return sorted.map((player, idx) => {
      // Handle ties
      if (idx > 0 && sorted[idx - 1].cumulativeScore === player.cumulativeScore) {
        return { ...player, rank: (sorted[idx - 1] as RankedPlayer).rank || rank };
      }
      rank = idx + 1;
      return { ...player, rank };
    }) as RankedPlayer[];
  }, [players]);

  return (
    <div className="bg-gray-800/50 backdrop-blur rounded-xl border border-purple-500/20 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-800/80 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-white">Scoreboard</h2>
          <span className="text-sm text-purple-400 font-mono">
            Round {currentRound}/{totalRounds}
          </span>
        </div>
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wider">
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">Player</th>
              <th className="px-4 py-2 text-right">Round</th>
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {rankedPlayers.map((player, idx) => {
                const isCurrentPlayer = player.id === currentPlayerId;
                const hasPrediction = predictionStatus[player.id];

                return (
                  <motion.tr
                    key={player.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`
                      border-b border-gray-700/50
                      ${isCurrentPlayer ? 'bg-purple-600/20' : 'hover:bg-gray-700/30'}
                    `}
                  >
                    <td className="px-4 py-3">
                      <span className={`
                        font-bold
                        ${player.rank === 1 ? 'text-yellow-400' : ''}
                        ${player.rank === 2 ? 'text-gray-300' : ''}
                        ${player.rank === 3 ? 'text-amber-600' : ''}
                        ${player.rank > 3 ? 'text-gray-500' : ''}
                      `}>
                        {player.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isCurrentPlayer ? 'text-purple-300' : 'text-white'}`}>
                          {player.name}
                          {isCurrentPlayer && <span className="text-purple-400 text-xs ml-1">(You)</span>}
                        </span>
                        {/* Prediction status */}
                        {hasPrediction !== undefined && (
                          <span className={`text-xs ${hasPrediction ? 'text-green-400' : 'text-gray-500'}`}>
                            {hasPrediction ? '(/)' : 'o'}
                          </span>
                        )}
                        {/* Connection indicator */}
                        {!player.isConnected && (
                          <span className="w-2 h-2 rounded-full bg-red-500" title="Disconnected" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <motion.span
                        key={player.currentRoundScore}
                        initial={{ scale: 1.2, color: '#4ade80' }}
                        animate={{ scale: 1, color: '#9ca3af' }}
                        className="font-mono text-gray-400"
                      >
                        {player.currentRoundScore > 0 ? '+' : ''}{player.currentRoundScore.toFixed(1)}
                      </motion.span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <motion.span
                        key={player.cumulativeScore}
                        initial={{ scale: 1.3, color: '#facc15' }}
                        animate={{ scale: 1, color: '#ffffff' }}
                        className="font-mono font-bold text-white"
                      >
                        {player.cumulativeScore.toFixed(1)}
                      </motion.span>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden p-2 space-y-2">
        <AnimatePresence>
          {rankedPlayers.map((player, idx) => {
            const isCurrentPlayer = player.id === currentPlayerId;
            const hasPrediction = predictionStatus[player.id];

            return (
              <motion.div
                key={player.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`
                  flex items-center justify-between p-3 rounded-lg
                  ${isCurrentPlayer ? 'bg-purple-600/30 border border-purple-500/50' : 'bg-gray-700/30'}
                `}
              >
                <div className="flex items-center gap-3">
                  {/* Rank badge */}
                  <div className={`
                    w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold
                    ${player.rank === 1 ? 'bg-yellow-500 text-black' : ''}
                    ${player.rank === 2 ? 'bg-gray-400 text-black' : ''}
                    ${player.rank === 3 ? 'bg-amber-600 text-white' : ''}
                    ${player.rank > 3 ? 'bg-gray-600 text-gray-300' : ''}
                  `}>
                    {player.rank}
                  </div>

                  {/* Player info */}
                  <div>
                    <div className="flex items-center gap-1">
                      <span className={`font-medium text-sm ${isCurrentPlayer ? 'text-purple-300' : 'text-white'}`}>
                        {player.name}
                      </span>
                      {hasPrediction !== undefined && (
                        <span className={`text-xs ${hasPrediction ? 'text-green-400' : 'text-gray-500'}`}>
                          {hasPrediction ? '(/)' : 'o'}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      Round: {player.currentRoundScore > 0 ? '+' : ''}{player.currentRoundScore.toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Score */}
                <motion.span
                  key={player.cumulativeScore}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  className="font-mono font-bold text-yellow-400 text-lg"
                >
                  {player.cumulativeScore.toFixed(1)}
                </motion.span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default Scoreboard;
