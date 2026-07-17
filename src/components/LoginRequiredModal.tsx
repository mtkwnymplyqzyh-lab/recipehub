import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LoginRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginRequiredModal({ isOpen, onClose }: LoginRequiredModalProps) {
  const { signIn } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.[0]?.focus();
      });
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSignIn = async () => {
    try {
      await signIn();
      onClose();
    } catch (error) {
      console.error('Sign in failed:', error);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[9998]"
            aria-hidden="true"
          />

          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[9999]">
            <motion.div
              ref={modalRef}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--card)] w-full max-w-md mx-4 rounded-3xl shadow-2xl overflow-hidden pointer-events-auto relative"
              role="dialog"
              aria-modal="true"
              aria-labelledby="login-modal-title"
            >
              <button
                onClick={onClose}
                className="absolute left-6 top-6 p-2 text-stone-400 hover:text-stone-900 transition-colors"
                aria-label="סגירת חלון"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>

              <div className="p-10 text-center space-y-6">
                <div className="mx-auto w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center" aria-hidden="true">
                  <Lock className="w-8 h-8 text-primary-600" />
                </div>

                <div className="space-y-2">
                  <h3 id="login-modal-title" className="font-serif text-2xl font-bold text-stone-900">יש להתחבר כדי להמשיך</h3>
                  <p className="text-stone-500 font-medium leading-relaxed">
                    כדי להוסיף מתכון חדש ולשתף את הקסם הקולינרי שלכם, עליכם להיות מחוברים למערכת.
                  </p>
                </div>

                <div className="pt-4 space-y-3">
                  <button
                    onClick={handleSignIn}
                    className="w-full bg-primary-500 text-white py-4 rounded-2xl font-bold hover:bg-primary-600 transition-all shadow-lg shadow-primary-100 flex items-center justify-center gap-3 active:scale-[0.98]"
                  >
                    <LogIn className="w-5 h-5" aria-hidden="true" />
                    התחברות עם Google
                  </button>
                  <button
                    onClick={onClose}
                    className="w-full py-4 text-stone-400 font-bold hover:text-stone-900 transition-colors"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
