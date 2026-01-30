import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ToastType = 'error' | 'success' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const toastStyles: Record<ToastType, { bg: string; border: string; icon: string; iconBg: string }> = {
  error: {
    bg: 'bg-gradient-to-r from-red-900/90 to-red-800/90',
    border: 'border-red-500/50',
    icon: 'M6 6l12 12M6 18L18 6',
    iconBg: 'bg-red-500',
  },
  success: {
    bg: 'bg-gradient-to-r from-green-900/90 to-green-800/90',
    border: 'border-green-500/50',
    icon: 'M5 13l4 4L19 7',
    iconBg: 'bg-green-500',
  },
  info: {
    bg: 'bg-gradient-to-r from-blue-900/90 to-blue-800/90',
    border: 'border-blue-500/50',
    icon: 'M12 8v4m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z',
    iconBg: 'bg-blue-500',
  },
  warning: {
    bg: 'bg-gradient-to-r from-yellow-900/90 to-yellow-800/90',
    border: 'border-yellow-500/50',
    icon: 'M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.73 4a2 2 0 00-3.46 0L3.34 16a2 2 0 001.73 3z',
    iconBg: 'bg-yellow-500',
  },
};

function Toast({ toast, onDismiss }: ToastProps) {
  const style = toastStyles[toast.type];
  const duration = toast.duration ?? 5000;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`
        ${style.bg} ${style.border}
        border rounded-xl shadow-2xl
        backdrop-blur-md
        p-4 pr-10
        min-w-[300px] max-w-[400px]
        relative
        overflow-hidden
      `}
    >
      {/* Progress bar for auto-dismiss */}
      {duration > 0 && (
        <motion.div
          className="absolute bottom-0 left-0 h-1 bg-white/30"
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
        />
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 500 }}
          className={`${style.iconBg} rounded-full p-2 flex-shrink-0`}
        >
          <svg
            className="w-4 h-4 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={style.icon} />
          </svg>
        </motion.div>

        {/* Message */}
        <div className="flex-1 pt-0.5">
          <p className="text-white font-medium text-sm leading-relaxed">
            {toast.message}
          </p>
        </div>
      </div>

      {/* Dismiss button */}
      <motion.button
        type="button"
        onClick={() => onDismiss(toast.id)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
        </svg>
      </motion.button>
    </motion.div>
  );
}

// Toast container component that manages multiple toasts
interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// Toast store hook for managing toasts globally
let toastId = 0;
const generateId = () => `toast-${++toastId}`;

type ToastStore = {
  toasts: ToastMessage[];
  listeners: Set<() => void>;
};

const toastStore: ToastStore = {
  toasts: [],
  listeners: new Set(),
};

const notifyListeners = () => {
  toastStore.listeners.forEach((listener) => listener());
};

export const toast = {
  show: (type: ToastType, message: string, duration?: number): string => {
    const id = generateId();
    toastStore.toasts = [...toastStore.toasts, { id, type, message, duration }];
    notifyListeners();
    return id;
  },
  error: (message: string, duration?: number) => toast.show('error', message, duration),
  success: (message: string, duration?: number) => toast.show('success', message, duration),
  info: (message: string, duration?: number) => toast.show('info', message, duration),
  warning: (message: string, duration?: number) => toast.show('warning', message, duration),
  dismiss: (id: string) => {
    toastStore.toasts = toastStore.toasts.filter((t) => t.id !== id);
    notifyListeners();
  },
  dismissAll: () => {
    toastStore.toasts = [];
    notifyListeners();
  },
};

// Hook to use toast store in React components
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>(toastStore.toasts);

  useEffect(() => {
    const listener = () => setToasts([...toastStore.toasts]);
    toastStore.listeners.add(listener);
    return () => {
      toastStore.listeners.delete(listener);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    toast.dismiss(id);
  }, []);

  return { toasts, dismiss, toast };
}

export default ToastContainer;
