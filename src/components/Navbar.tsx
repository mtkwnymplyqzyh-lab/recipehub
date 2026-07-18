import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, LogOut, UtensilsCrossed } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useState } from 'react';
import { LoginRequiredModal } from './LoginRequiredModal';

export function Navbar() {
  const navigate = useNavigate();
  const { user, profile, signIn, logout } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

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
            onClick={() => user ? navigate('/create') : setIsAuthModalOpen(true)}
            className="text-stone-500 hover:text-primary-600 font-medium transition-colors cursor-pointer"
          >
            הוספת מתכון
          </button>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <Link to="/profile" className="flex items-center gap-2 group border-r border-stone-200 dark:border-stone-700 pr-4">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt={profile.displayName} className="w-8 h-8 rounded-full border-2 border-primary-100" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center border-2 border-primary-200/50">
                    <User className="w-4 h-4 text-primary-600" />
                  </div>
                )}
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
        </div>
      </div>
      
      <LoginRequiredModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </nav>
  );
}
