import { useState } from 'react';
import { motion } from 'framer-motion';
import { socketService } from '@/services/socket';
import { useGameStore } from '@/stores/gameStore';

interface CreateRoomProps {
  onBack?: () => void;
}

export function CreateRoom({ onBack: _onBack }: CreateRoomProps) {
  const [playerName, setPlayerName] = useState('');
  const { setPlayerName: storeSetPlayerName, setIsLoading, ui, setError } = useGameStore();

  const isValidName = playerName.trim().length >= 1 && playerName.trim().length <= 20;

  const handleCreateGame = () => {
    if (!isValidName) {
      setError('Name must be between 1 and 20 characters');
      return;
    }

    setError(null);
    setIsLoading(true);
    storeSetPlayerName(playerName.trim());

    const socket = socketService.connect();

    socket.emit('room:create', {
      playerName: playerName.trim(),
      config: {},
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValidName && !ui.isLoading) {
      handleCreateGame();
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="playerName" className="block text-sm font-medium text-[var(--color-silver)] mb-2">
          Your Name
        </label>
        <input
          id="playerName"
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your name"
          className="input-noir w-full"
          maxLength={20}
          autoFocus
        />
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-[var(--color-pewter)]">
            {playerName.length > 0 && !isValidName && 'Name required'}
          </span>
          <span className={`text-xs ${playerName.length > 15 ? 'text-[var(--color-honey)]' : 'text-[var(--color-slate)]'}`}>
            {playerName.length}/20
          </span>
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleCreateGame}
        disabled={!isValidName || ui.isLoading}
        className="btn-crimson w-full py-3.5"
      >
        {ui.isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <motion.div
              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            Creating Room...
          </span>
        ) : (
          'Create Game'
        )}
      </motion.button>
    </div>
  );
}
