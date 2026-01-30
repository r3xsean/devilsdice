import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/stores/gameStore';
import { socketService } from '@/services/socket';
import { CreateRoom, JoinRoom } from '@/components/lobby';

type Tab = 'create' | 'join';

// Decorative dice SVG for the logo
function LogoDice() {
  return (
    <motion.div
      className="relative w-20 h-20 mx-auto mb-4"
      initial={{ rotate: -10 }}
      animate={{ rotate: [0, -5, 5, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* First die - rotated */}
      <motion.div
        className="absolute inset-0 die-red rounded-xl flex items-center justify-center"
        style={{ transform: 'rotate(-15deg) translateX(-8px)' }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, type: 'spring' }}
      >
        <div className="grid grid-cols-2 gap-2 p-3">
          <div className="w-2.5 h-2.5 rounded-full die-pip-light" />
          <div className="w-2.5 h-2.5 rounded-full die-pip-light" />
          <div className="w-2.5 h-2.5 rounded-full die-pip-light" />
          <div className="w-2.5 h-2.5 rounded-full die-pip-light" />
        </div>
      </motion.div>
      {/* Second die - rotated opposite */}
      <motion.div
        className="absolute inset-0 die-white rounded-xl flex items-center justify-center"
        style={{ transform: 'rotate(15deg) translateX(8px)' }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, type: 'spring' }}
      >
        <div className="flex flex-col items-center justify-center gap-1.5 p-2">
          <div className="flex gap-3">
            <div className="w-2.5 h-2.5 rounded-full die-pip-dark" />
            <div className="w-2.5 h-2.5 rounded-full die-pip-dark" />
          </div>
          <div className="w-2.5 h-2.5 rounded-full die-pip-dark" />
          <div className="flex gap-3">
            <div className="w-2.5 h-2.5 rounded-full die-pip-dark" />
            <div className="w-2.5 h-2.5 rounded-full die-pip-dark" />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('create');
  const { ui, setError, setIsLoading, connectionStatus } = useGameStore();

  // Reset loading state on mount and clear any stale reconnect tokens
  useEffect(() => {
    setIsLoading(false);
    // Clear stale reconnect tokens - if user is on Home page, they're starting fresh
    socketService.clearReconnectToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount - setIsLoading is stable from Zustand

  // Clear errors when switching tabs
  useEffect(() => {
    setError(null);
  }, [activeTab, setError]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Atmospheric background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top glow */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[var(--color-blood)]/30 rounded-full blur-[120px]" />
        {/* Bottom corner accents */}
        <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] bg-[var(--color-abyss)]/40 rounded-full blur-[80px]" />
        <div className="absolute -bottom-20 -right-20 w-[200px] h-[200px] bg-[var(--color-ruby)]/20 rounded-full blur-[60px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-md w-full relative z-10"
      >
        {/* Game Title/Logo */}
        <div className="text-center mb-8">
          <LogoDice />

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-5xl md:text-6xl font-display font-bold text-[var(--color-ivory)] mb-3 tracking-tight"
          >
            Devil's
            <span className="block text-[var(--color-scarlet)]">Dice</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-[var(--color-silver)] font-body text-lg"
          >
            Roll the dice. Test your fate.
          </motion.p>
        </div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="card-noir p-6 md:p-8"
        >
          {/* Tab Navigation */}
          <div className="flex mb-6 bg-[var(--color-charcoal)] rounded-lg p-1 relative">
            {/* Animated background indicator */}
            <motion.div
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-gradient-to-r from-[var(--color-ruby)] to-[var(--color-blood)] rounded-md"
              animate={{ x: activeTab === 'create' ? 0 : 'calc(100% + 4px)' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />

            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-2.5 px-4 rounded-md text-sm font-semibold transition-colors relative z-10 ${
                activeTab === 'create'
                  ? 'text-white'
                  : 'text-[var(--color-pewter)] hover:text-[var(--color-silver)]'
              }`}
            >
              Create Game
            </button>
            <button
              onClick={() => setActiveTab('join')}
              className={`flex-1 py-2.5 px-4 rounded-md text-sm font-semibold transition-colors relative z-10 ${
                activeTab === 'join'
                  ? 'text-white'
                  : 'text-[var(--color-pewter)] hover:text-[var(--color-silver)]'
              }`}
            >
              Join Game
            </button>
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeTab === 'create' ? (
              <motion.div
                key="create"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <CreateRoom onBack={() => setActiveTab('join')} />
              </motion.div>
            ) : (
              <motion.div
                key="join"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <JoinRoom />
              </motion.div>
            )}
          </AnimatePresence>

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

          {/* Connection Status */}
          <AnimatePresence>
            {connectionStatus === 'connecting' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-4 flex items-center justify-center gap-2 text-[var(--color-silver)] text-sm"
              >
                <motion.div
                  className="w-4 h-4 border-2 border-[var(--color-ruby)] border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                Connecting to server...
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-6"
        >
          <p className="text-[var(--color-slate)] text-xs tracking-wide">
            2-6 players • Strategic dice selection • Hidden information
          </p>
          <p className="text-[var(--color-slate)]/60 text-xs mt-2">
            Inspired by Devil's Plan Season 2
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
