import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, type ConnectionStatus } from '@/stores/gameStore';

interface ConnectionOverlayProps {
  forceShow?: boolean;
}

export function ConnectionOverlay({ forceShow = false }: ConnectionOverlayProps) {
  const connectionStatus = useGameStore((state) => state.connectionStatus);
  const [showOverlay, setShowOverlay] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [hasEverConnected, setHasEverConnected] = useState(false);

  // Track if user has ever been connected (for SEO: don't show overlay on initial load)
  useEffect(() => {
    if (connectionStatus === 'connected') {
      setHasEverConnected(true);
    }
  }, [connectionStatus]);

  // Only show overlay for disconnected/reconnecting states AFTER user has connected once
  // This prevents showing "Connection Lost" to search engine crawlers on initial page load
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const shouldShow = forceShow || (
      hasEverConnected &&
      (connectionStatus === 'disconnected' || connectionStatus === 'reconnecting')
    );

    if (shouldShow) {
      timeout = setTimeout(() => {
        setShowOverlay(true);
      }, 500); // 500ms delay before showing
    } else if (connectionStatus === 'connected') {
      setShowOverlay(false);
      setReconnectAttempt(0);
    }

    return () => clearTimeout(timeout);
  }, [connectionStatus, forceShow, hasEverConnected]);

  // Increment reconnect attempt counter during reconnection
  useEffect(() => {
    if (connectionStatus === 'reconnecting') {
      const interval = setInterval(() => {
        setReconnectAttempt((prev) => prev + 1);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [connectionStatus]);

  const getStatusInfo = (status: ConnectionStatus) => {
    switch (status) {
      case 'disconnected':
        return {
          title: 'Connection Lost',
          message: 'You have been disconnected from the server.',
          action: 'Attempting to reconnect...',
          color: 'from-red-500 to-red-600',
          pulse: true,
        };
      case 'reconnecting':
        return {
          title: 'Reconnecting',
          message: `Attempting to reconnect... (Attempt ${reconnectAttempt + 1})`,
          action: 'Please wait...',
          color: 'from-yellow-500 to-orange-500',
          pulse: true,
        };
      case 'connecting':
        return {
          title: 'Connecting',
          message: 'Establishing connection to server...',
          action: 'Please wait...',
          color: 'from-blue-500 to-blue-600',
          pulse: true,
        };
      default:
        return {
          title: 'Connected',
          message: 'Successfully connected!',
          action: '',
          color: 'from-green-500 to-green-600',
          pulse: false,
        };
    }
  };

  const statusInfo = getStatusInfo(connectionStatus);

  return (
    <AnimatePresence>
      {showOverlay && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-gray-900/90 border border-gray-700 rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl"
          >
            {/* Animated connection icon */}
            <motion.div
              className="relative mx-auto w-20 h-20 mb-6"
              animate={statusInfo.pulse ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {/* Outer ring */}
              <motion.div
                className={`absolute inset-0 rounded-full bg-gradient-to-r ${statusInfo.color} opacity-20`}
                animate={statusInfo.pulse ? {
                  scale: [1, 1.5, 1],
                  opacity: [0.2, 0, 0.2],
                } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              />

              {/* Inner circle */}
              <div className={`absolute inset-2 rounded-full bg-gradient-to-r ${statusInfo.color} flex items-center justify-center`}>
                {/* WiFi/Connection icon */}
                <svg
                  className="w-10 h-10 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {connectionStatus === 'connected' ? (
                    // Checkmark for connected
                    <path d="M5 13l4 4L19 7" />
                  ) : (
                    // WiFi waves for connecting/reconnecting
                    <>
                      <motion.path
                        d="M5 12.55a11 11 0 0 1 14.08 0"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                      />
                      <motion.path
                        d="M8.53 16.11a6 6 0 0 1 6.95 0"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                      />
                      <motion.circle
                        cx="12"
                        cy="20"
                        r="1"
                        fill="currentColor"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                      />
                    </>
                  )}
                </svg>
              </div>
            </motion.div>

            {/* Title */}
            <motion.h2
              className="text-2xl font-bold text-white font-display mb-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {statusInfo.title}
            </motion.h2>

            {/* Message */}
            <motion.p
              className="text-gray-400 mb-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {statusInfo.message}
            </motion.p>

            {/* Action/spinner */}
            {statusInfo.action && (
              <motion.div
                className="flex items-center justify-center gap-3 text-gray-300"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <motion.div
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                <span className="text-sm">{statusInfo.action}</span>
              </motion.div>
            )}

            {/* Retry button for prolonged disconnection */}
            {(connectionStatus === 'disconnected' || reconnectAttempt >= 3) && (
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                onClick={() => window.location.reload()}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="mt-6 px-6 py-2 bg-gradient-to-r from-crimson to-red-600 text-white rounded-lg font-medium hover:from-red-600 hover:to-red-700 transition-colors"
              >
                Refresh Page
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ConnectionOverlay;
