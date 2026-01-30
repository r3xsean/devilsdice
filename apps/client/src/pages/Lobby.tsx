import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/stores/gameStore';
import { socketService, getSocket } from '@/services/socket';
import { PlayerList, GameSettings } from '@/components/lobby';
import { GamePhase, GAME_LIMITS } from '@devilsdice/shared';
import type { GameConfig } from '@devilsdice/shared';

export default function Lobby() {
  const navigate = useNavigate();
  const { roomCode: urlRoomCode } = useParams<{ roomCode: string }>();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [joinName, setJoinName] = useState('');

  const {
    room,
    player,
    connectionStatus,
    setIsReady,
    setRoomConfig,
    setPlayerName: storeSetPlayerName,
    setRoomCode: storeSetRoomCode,
    ui,
    setIsLoading,
    setError,
  } = useGameStore();

  // Check if user needs to join (has URL room code but isn't in the room)
  const needsToJoin = urlRoomCode && !room.roomCode && connectionStatus === 'connected';

  // Setup socket event listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      navigate('/');
      return;
    }

    const handlePhaseChange = (data: { phase: GamePhase }) => {
      if (data.phase !== GamePhase.LOBBY) {
        const code = room.roomCode || urlRoomCode;
        if (code) {
          navigate(`/game/${code}`);
        }
      }
    };

    socket.on('game:phaseChange', handlePhaseChange);

    return () => {
      socket.off('game:phaseChange', handlePhaseChange);
    };
  }, [navigate, room.roomCode, urlRoomCode]);

  // Redirect if not in a room and no URL room code to join
  useEffect(() => {
    if (!room.roomCode && !urlRoomCode && connectionStatus === 'connected') {
      navigate('/');
    }
  }, [room.roomCode, urlRoomCode, connectionStatus, navigate]);

  // Handle joining via URL
  const handleJoinViaUrl = () => {
    if (!urlRoomCode || !joinName.trim()) return;

    setError(null);
    setIsLoading(true);
    storeSetPlayerName(joinName.trim());
    storeSetRoomCode(urlRoomCode);

    const socket = socketService.connect();
    socket.emit('room:join', {
      roomCode: urlRoomCode.toUpperCase(),
      playerName: joinName.trim(),
    });
  };

  const handleToggleReady = () => {
    const socket = getSocket();
    if (!socket) return;

    setIsLoading(true);
    if (player.isReady) {
      socket.emit('game:unready');
      setIsReady(false);
    } else {
      socket.emit('game:ready');
      setIsReady(true);
    }
    setIsLoading(false);
  };

  const handleStartGame = () => {
    const socket = getSocket();
    if (!socket) return;

    setIsLoading(true);
    socket.emit('game:start');
  };

  const handleLeaveRoom = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('room:leave');
    }
    socketService.clearReconnectToken();
    navigate('/');
  };

  const handleCopyRoomCode = useCallback(async () => {
    const code = room.roomCode || urlRoomCode;
    if (code) {
      try {
        // Copy the full lobby URL for easy sharing
        const url = `${window.location.origin}/lobby/${code}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy room link:', err);
      }
    }
  }, [room.roomCode, urlRoomCode]);

  const handleConfigUpdate = useCallback(
    (config: Partial<GameConfig>) => {
      const socket = getSocket();
      if (!socket || !room.isHost) return;

      socket.emit('game:updateConfig', config);
      if (room.config) {
        setRoomConfig({ ...room.config, ...config });
      }
    },
    [room.isHost, room.config, setRoomConfig]
  );

  const formatRoomCode = (code: string | null): string => {
    if (!code) return '------';
    if (code.length <= 3) return code;
    return `${code.slice(0, 3)}-${code.slice(3)}`;
  };

  const allPlayersReady =
    room.players.length >= GAME_LIMITS.MIN_PLAYERS &&
    room.players.every((p) => p.isReady);
  const canStart = room.isHost && allPlayersReady;
  const hostId = room.players.find((p) => p.isHost)?.id || '';

  // Show join form if user navigated directly to lobby URL
  if (needsToJoin) {
    const isValidName = joinName.trim().length >= 1 && joinName.trim().length <= 20;

    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[var(--color-blood)]/20 rounded-full blur-[100px]" />
          <div className="absolute -bottom-20 -right-20 w-[300px] h-[300px] bg-[var(--color-abyss)]/30 rounded-full blur-[80px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full relative z-10"
        >
          <div className="card-noir p-6 md:p-8">
            {/* Room Code Display */}
            <div className="text-center mb-6">
              <p className="text-[var(--color-pewter)] text-sm mb-2 uppercase tracking-wider">Joining Room</p>
              <span className="text-3xl md:text-4xl font-mono font-bold text-[var(--color-ivory)] tracking-[0.2em]">
                {formatRoomCode(urlRoomCode)}
              </span>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-[var(--color-ruby)]/30 to-transparent mb-6" />

            {/* Name Input */}
            <div className="space-y-5">
              <div>
                <label htmlFor="joinName" className="block text-sm font-medium text-[var(--color-silver)] mb-2">
                  Your Name
                </label>
                <input
                  id="joinName"
                  type="text"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isValidName && !ui.isLoading) {
                      handleJoinViaUrl();
                    }
                  }}
                  placeholder="Enter your name"
                  className="input-noir w-full"
                  maxLength={20}
                  autoFocus
                />
                <div className="flex justify-end mt-1.5">
                  <span className={`text-xs ${joinName.length > 15 ? 'text-[var(--color-honey)]' : 'text-[var(--color-slate)]'}`}>
                    {joinName.length}/20
                  </span>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleJoinViaUrl}
                disabled={!isValidName || ui.isLoading}
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

              <button
                onClick={() => navigate('/')}
                className="w-full py-2 text-[var(--color-pewter)] hover:text-[var(--color-silver)] text-sm transition-colors"
              >
                Back to Home
              </button>
            </div>

            {/* Error Display */}
            <AnimatePresence>
              {ui.error && (
                <motion.div
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  className="mt-4 p-3 bg-[var(--color-ruby)]/20 border border-[var(--color-ruby)]/40 rounded-lg overflow-hidden"
                >
                  <p className="text-[var(--color-flame)] text-center text-sm font-medium">{ui.error}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[var(--color-blood)]/20 rounded-full blur-[100px]" />
        <div className="absolute -bottom-20 -right-20 w-[300px] h-[300px] bg-[var(--color-abyss)]/30 rounded-full blur-[80px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full relative z-10"
      >
        <div className="card-noir p-6 md:p-8">
          {/* Room Code Header */}
          <div className="text-center mb-8">
            <p className="text-[var(--color-pewter)] text-sm mb-2 uppercase tracking-wider">Room Code</p>
            <motion.button
              onClick={handleCopyRoomCode}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group relative"
              title="Click to copy"
            >
              <span className="text-4xl md:text-5xl font-mono font-bold text-[var(--color-ivory)] tracking-[0.2em] hover:text-[var(--color-champagne)] transition-colors">
                {formatRoomCode(room.roomCode)}
              </span>
              <AnimatePresence>
                {copied && (
                  <motion.span
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs text-[var(--color-champagne)] bg-[var(--color-gold)]/20 px-3 py-1 rounded-full"
                  >
                    Link copied!
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
            <p className="text-[var(--color-slate)] text-xs mt-2 flex items-center justify-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
                <path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z" />
              </svg>
              Click to copy invite link
            </p>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-[var(--color-ruby)]/30 to-transparent mb-6" />

          {/* Players List */}
          <div className="mb-6">
            <h2 className="text-lg font-display font-semibold text-[var(--color-ivory)] mb-4 flex items-center gap-2">
              <span>Players</span>
              <span className="text-sm font-mono text-[var(--color-pewter)]">
                {room.players.length}/{room.config?.maxPlayers || GAME_LIMITS.MAX_PLAYERS}
              </span>
            </h2>
            <PlayerList
              players={room.players}
              hostId={hostId}
              currentPlayerId={player.playerId || ''}
              maxPlayers={room.config?.maxPlayers || GAME_LIMITS.MAX_PLAYERS}
            />
          </div>

          {/* Game Settings */}
          {room.config && (
            <div className="mb-6">
              <GameSettings
                config={room.config}
                isHost={room.isHost}
                onUpdate={handleConfigUpdate}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Ready/Start button */}
            {room.isHost ? (
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStartGame}
                disabled={!canStart || ui.isLoading}
                className="btn-gold w-full py-3.5"
              >
                {ui.isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.div
                      className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    Starting...
                  </span>
                ) : room.players.length < GAME_LIMITS.MIN_PLAYERS ? (
                  `Need at least ${GAME_LIMITS.MIN_PLAYERS} players`
                ) : !allPlayersReady ? (
                  'Waiting for players to ready up...'
                ) : (
                  'Start Game'
                )}
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleToggleReady}
                disabled={ui.isLoading}
                className={`w-full py-3.5 font-semibold rounded-xl transition-all ${
                  player.isReady
                    ? 'btn-ghost'
                    : 'btn-crimson'
                }`}
              >
                {player.isReady ? 'Cancel Ready' : 'Ready Up'}
              </motion.button>
            )}

            {/* Host ready toggle */}
            {room.isHost && (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleToggleReady}
                disabled={ui.isLoading}
                className={`w-full py-2.5 text-sm font-medium rounded-lg transition-all border ${
                  player.isReady
                    ? 'bg-[var(--color-charcoal)] border-[var(--color-slate)] text-[var(--color-silver)] hover:bg-[var(--color-ash)]'
                    : 'bg-[var(--color-ruby)]/20 border-[var(--color-ruby)]/40 text-[var(--color-flame)] hover:bg-[var(--color-ruby)]/30'
                }`}
              >
                {player.isReady ? 'Unready' : 'Mark yourself as ready'}
              </motion.button>
            )}

            {/* Leave Room button */}
            <div className="relative h-10">
              <AnimatePresence mode="wait">
                {showLeaveConfirm ? (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute inset-0 flex gap-2"
                  >
                    <button
                      onClick={handleLeaveRoom}
                      className="flex-1 py-2 bg-[var(--color-ruby)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-scarlet)] transition-colors"
                    >
                      Yes, Leave
                    </button>
                    <button
                      onClick={() => setShowLeaveConfirm(false)}
                      className="flex-1 py-2 bg-[var(--color-ash)] text-[var(--color-silver)] text-sm font-medium rounded-lg hover:bg-[var(--color-slate)] transition-colors"
                    >
                      Cancel
                    </button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="leave"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowLeaveConfirm(true)}
                    className="w-full py-2 text-[var(--color-pewter)] hover:text-[var(--color-flame)] text-sm transition-colors"
                  >
                    Leave Room
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Error Display */}
          <AnimatePresence>
            {ui.error && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="mt-4 p-3 bg-[var(--color-ruby)]/20 border border-[var(--color-ruby)]/40 rounded-lg overflow-hidden"
              >
                <p className="text-[var(--color-flame)] text-center text-sm font-medium">{ui.error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Connection status indicator */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected'
                ? 'bg-green-500'
                : connectionStatus === 'connecting' || connectionStatus === 'reconnecting'
                ? 'bg-[var(--color-honey)] animate-pulse'
                : 'bg-[var(--color-ruby)]'
            }`}
          />
          <span className="text-[var(--color-slate)] text-xs">
            {connectionStatus === 'connected'
              ? 'Connected'
              : connectionStatus === 'connecting'
              ? 'Connecting...'
              : connectionStatus === 'reconnecting'
              ? 'Reconnecting...'
              : 'Disconnected'}
          </span>
        </div>
      </motion.div>
    </div>
  );
}
