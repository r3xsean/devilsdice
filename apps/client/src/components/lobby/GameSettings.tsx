import { useState, useEffect, useCallback } from 'react';
import type { GameConfig } from '@devilsdice/shared';
import { GAME_LIMITS } from '@devilsdice/shared';

interface GameSettingsProps {
  config: GameConfig;
  isHost: boolean;
  onUpdate: (config: Partial<GameConfig>) => void;
}

export function GameSettings({ config, isHost, onUpdate }: GameSettingsProps) {
  const [localRounds, setLocalRounds] = useState(config.totalRounds);
  const [localTimer, setLocalTimer] = useState(config.turnTimerSeconds);

  // Sync local state with props
  useEffect(() => {
    setLocalRounds(config.totalRounds);
    setLocalTimer(config.turnTimerSeconds);
  }, [config.totalRounds, config.turnTimerSeconds]);

  // Debounced update function
  const debouncedUpdate = useCallback((updates: Partial<GameConfig>) => {
    const timeoutId = setTimeout(() => {
      onUpdate(updates);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [onUpdate]);

  const handleRoundsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setLocalRounds(value);
    if (isHost) {
      debouncedUpdate({ totalRounds: value });
    }
  };

  const handleTimerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setLocalTimer(value);
    if (isHost) {
      debouncedUpdate({ turnTimerSeconds: value });
    }
  };

  return (
    <div className="p-4 bg-gray-700/30 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-300">Game Settings</h3>
        {!isHost && (
          <span className="text-xs text-gray-500 italic">Only host can change settings</span>
        )}
      </div>

      <div className="space-y-4">
        {/* Rounds slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="rounds" className="text-sm text-gray-400">
              Number of Rounds
            </label>
            <span className="text-white font-medium bg-gray-600/50 px-2 py-0.5 rounded text-sm">
              {localRounds}
            </span>
          </div>
          <input
            id="rounds"
            type="range"
            min={GAME_LIMITS.MIN_ROUNDS}
            max={GAME_LIMITS.MAX_ROUNDS}
            value={localRounds}
            onChange={handleRoundsChange}
            disabled={!isHost}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
              isHost
                ? 'bg-gray-600 accent-purple-500'
                : 'bg-gray-700 cursor-not-allowed opacity-50'
            }`}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{GAME_LIMITS.MIN_ROUNDS}</span>
            <span>{GAME_LIMITS.MAX_ROUNDS}</span>
          </div>
        </div>

        {/* Timer slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="timer" className="text-sm text-gray-400">
              Turn Timer
            </label>
            <span className="text-white font-medium bg-gray-600/50 px-2 py-0.5 rounded text-sm">
              {localTimer}s
            </span>
          </div>
          <input
            id="timer"
            type="range"
            min={GAME_LIMITS.MIN_TIMER}
            max={GAME_LIMITS.MAX_TIMER}
            step={5}
            value={localTimer}
            onChange={handleTimerChange}
            disabled={!isHost}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
              isHost
                ? 'bg-gray-600 accent-purple-500'
                : 'bg-gray-700 cursor-not-allowed opacity-50'
            }`}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{GAME_LIMITS.MIN_TIMER}s</span>
            <span>{GAME_LIMITS.MAX_TIMER}s</span>
          </div>
        </div>
      </div>
    </div>
  );
}
