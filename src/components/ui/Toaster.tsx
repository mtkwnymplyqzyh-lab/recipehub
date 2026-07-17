import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

let toastFn: (msg: string, type: 'success' | 'error') => void;

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    toastFn = (message, type) => {
      const id = Math.random().toString(36).substring(2);
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={clsx(
              "px-4 py-3 rounded-lg shadow-lg text-sm font-medium min-w-[200px]",
              toast.type === 'success' ? "bg-stone-900 text-white" : "bg-red-500 text-white"
            )}
          >
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

import { clsx } from 'clsx';

export const toast = (msg: string, type: 'success' | 'error' = 'success') => {
  if (toastFn) toastFn(msg, type);
};
