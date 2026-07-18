import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, UtensilsCrossed, Menu, X, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { LoginRequiredModal } from './LoginRequiredModal';
import { useOnboardingTour } from '../hooks/useOnboardingTour';

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signIn, logout } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { start: startTour } = useOnboardingTour();

  const restartTour = () => {
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(startTour, 150);
    } else {
      startTour();
    }
  };

  const handleCreateClick = () => {
    setIsMobileMenuOpen(false);
    if (user) {
      navigate('/create');
    } else {
      setIsAuthModalOpen(true);
    }
  };

  return (
    <nav className="bg-[var(--card)]/80 backdrop-blur-md sticky top-0 z-50 border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="bg-primary-500 p-2 rounded-xl group-hover:rotate-12 transition-transform shadow-lg shadow-primary-200/40">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <span className="font-serif text-xl font-bold tracking-tight text-[var(--foreground)]">Recipe<span className="text-primary-600">Hub</span></span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link to="/" className="text-stone-500 hover:text-primary-600 font-medium transition-colors">מתכונים</Link>
          <button
            onClick={handleCreateClick}
            className="text-stone-500 hover:text-primary-600 font-medium transition-colors cursor-pointer"
          >
            הוספת מתכון
          </button>
          <button
            onClick={restartTour}
            className="text-stone-400 hover:text-primary-600 transition-colors"
            aria-label="הצגת סיור הדרכה"
            title="עזרה"
          >
            <HelpCircle className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <Link to="/profile" className="flex items-center gap-2 group border-r border-stone-200 dark:border-stone-700 pr-4" data-tour="profile-link">
                <img
                  src={profile?.photoURL || '/default-avatar.png'}
                  alt={profile?.displayName || 'שף'}
                  className="w-8 h-8 rounded-full border-2 border-primary-100 object-cover"
                />
                <span className="text-sm font-bold hidden sm:inline text-[var(--foreground)] group-hover:text-primary-600 transition-colors">{profile?.displayName || 'שף'}</span>
              </Link>
              <button
                onClick={logout}
                className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                aria-label="התנתקות"
              >
                <LogOut className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              onClick={signIn}
              className="bg-primary-500 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-primary-600 transition-all active:scale-95 shadow-lg shadow-primary-200 dark:shadow-none"
            >
              התחברות
            </button>
          )}

          <button
            onClick={() => setIsMobileMenuOpen(prev => !prev)}
            className="p-2 -mr-2 text-stone-500 md:hidden"
            aria-label={isMobileMenuOpen ? 'סגירת תפריט' : 'פתיחת תפריט'}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 top-16 bg-stone-900/20 backdrop-blur-[1px] z-40 md:hidden"
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute inset-x-0 top-full bg-[var(--card)] border-b border-[var(--border)] shadow-xl z-50 md:hidden"
            >
              <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-1">
                <Link
                  to="/"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-4 py-3 rounded-xl text-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800 font-bold transition-colors"
                >
                  מתכונים
                </Link>
                <button
                  onClick={handleCreateClick}
                  className="px-4 py-3 rounded-xl text-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800 font-bold text-right transition-colors"
                >
                  הוספת מתכון
                </button>
                {user && (
                  <Link
                    to="/profile"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="px-4 py-3 rounded-xl text-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800 font-bold transition-colors"
                  >
                    המתכונים שלי
                  </Link>
                )}
                <button
                  onClick={() => { setIsMobileMenuOpen(false); restartTour(); }}
                  className="px-4 py-3 rounded-xl text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 font-bold text-right flex items-center gap-2 transition-colors"
                >
                  <HelpCircle className="w-4 h-4" aria-hidden="true" />
                  סיור הדרכה
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <LoginRequiredModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </nav>
  );
}
