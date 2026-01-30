import { useState } from 'react';
import { motion } from 'framer-motion';
import { socketService } from '@/services/socket';
import { useGameStore } from '@/stores/gameStore';
import { GAME_LIMITS } from '@devilsdice/shared';

export function JoinRoom() {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const { setPlayerName: storeSetPlayerName, setIsLoading, ui, setError } = useGameStore();

  const isValidName = playerName.trim().length >= 1 && playerName.trim().length <= 20;
  const isValidRoomCode = roomCode.length === GAME_LIMITS.ROOM_CODE_LENGTH;
  const canJoin = isValidName && isValidRoomCode && !ui.isLoading;

  const formatRoomCode = (code: string): string => {
    const formatted = code.toUpperCase();
    if (formatted.length <= 3) return formatted;
    return `${formatted.slice(0, 3)}-${formatted.slice(3)}`;
  };

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (value.length <= GAME_LIMITS.ROOM_CODE_LENGTH) {
      setRoomCode(value);
    }
  };

  const handleJoinGame = () => {
    if (!isValidName) {
      setError('Name must be between 1 and 20 characters');
      return;
    }
    if (!isValidRoomCode) {
      setError(`Room code must be ${GAME_LIMITS.ROOM_CODE_LENGTH} characters`);
      return;
    }

    setError(null);
    setIsLoading(true);
    storeSetPlayerName(playerName.trim());

    const socket = socketService.connect();

    socket.emit('room:join', {
      roomCode: roomCode.toUpperCase(),
      playerName: playerName.trim(),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canJoin) {
      handleJoinGame();
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

      <div>
        <label htmlFor="roomCode" className="block text-sm font-medium text-[var(--color-silver)] mb-2">
          Room Code
        </label>
        <input
          id="roomCode"
          type="text"
          value={formatRoomCode(roomCode)}
          onChange={handleRoomCodeChange}
          onKeyDown={handleKeyDown}
          placeholder="ABC-123"
          className="input-noir input-code w-full"
        />
        <p className="text-xs text-[var(--color-slate)] mt-1.5 text-center">
          {roomCode.length}/{GAME_LIMITS.ROOM_CODE_LENGTH} characters
        </p>
      </div>

      <motion.button
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleJoinGame}
        disabled={!canJoin}
        className="btn-gold w-full py-3.5"
      >
        {ui.isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <motion.div
              className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            Joining...
          </span>
        ) : (
          'Join Game'
        )}
      </motion.button>
    </div>
  );
}
