import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Utensils } from 'lucide-react';
import { useRecipes } from '../hooks/useRecipes';
import { RecipeCard } from '../components/RecipeCard';
import { Category } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { LoginRequiredModal } from '../components/LoginRequiredModal';
import { useOnboardingTour } from '../hooks/useOnboardingTour';
import { DEFAULT_CATEGORIES, DEFAULT_CUISINES } from '../lib/categories';

const CATEGORIES: (Category | 'הכל')[] = ['הכל', ...DEFAULT_CATEGORIES, 'אחר'];
const CUISINES: string[] = ['הכל', ...DEFAULT_CUISINES, 'אחר'];

export function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { recipes, loading, fetchRecipes } = useRecipes();
  const [activeCategory, setActiveCategory] = useState<Category | 'הכל'>('הכל');
  const [activeCuisine, setActiveCuisine] = useState<string | 'הכל'>('הכל');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { startIfNotSeen } = useOnboardingTour();

  useEffect(() => {
    startIfNotSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCategoryChange = (cat: Category | 'הכל') => {
    setActiveCategory(cat);
    fetchRecipes(cat === 'הכל' ? undefined : cat);
  };

  const handleCreateClick = () => {
    if (user) {
      navigate('/create');
    } else {
      setIsAuthModalOpen(true);
    }
  };

  const filteredRecipes = useMemo(() => recipes.filter(r => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      r.title.toLowerCase().includes(q) ||
      r.ingredients.some(i => i.name.toLowerCase().includes(q));

    const matchesCuisine =
      activeCuisine === 'הכל' ||
      (activeCuisine === 'אחר'
        ? !!r.cuisine && !DEFAULT_CUISINES.includes(r.cuisine)
        : r.cuisine === activeCuisine);

    return matchesSearch && matchesCuisine;
  }), [recipes, searchQuery, activeCuisine]);

  return (
    <div className="space-y-12">
      <header className="text-center max-w-2xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="font-serif text-5xl md:text-7xl font-bold tracking-tight text-[var(--foreground)] leading-tight">
            נהל את כל המתכונים שלך <span className="italic text-primary-600">במקום אחד</span> פשוט
          </h1>
          <p className="mt-6 text-xl text-stone-500 dark:text-stone-400 font-medium leading-relaxed">
            שמור מתכונים, ארגן לפי קטגוריות ושתף בקלות
          </p>
          <div className="pt-6 flex justify-center">
            <button
              onClick={handleCreateClick}
              className="bg-primary-500 text-white px-10 py-4 rounded-2xl font-bold hover:bg-primary-600 transition-all shadow-xl shadow-primary-200 dark:shadow-none active:scale-95 flex items-center gap-3 cursor-pointer text-lg"
              id="add-recipe-hero-btn"
              data-tour="create-recipe"
            >
              <Utensils className="w-6 h-6" aria-hidden="true" />
              הוספת מתכון חדש
            </button>
          </div>
        </motion.div>

        <LoginRequiredModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />

        <div className="relative max-w-lg mx-auto group" data-tour="search">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 group-focus-within:text-primary-500 transition-colors" aria-hidden="true" />
          <input
            type="search"
            aria-label="חיפוש מתכונים לפי שם או רכיב"
            placeholder="חפשו לפי שם מתכון או רכיב..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-12 pl-4 py-4 bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-sm focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-[var(--foreground)]"
          />
        </div>
      </header>

      <section className="space-y-6" aria-label="סינון לפי מטבחים">
        <div className="flex items-center justify-between px-2">
          <h2 className="font-serif text-3xl font-bold text-[var(--foreground)]">גלו לפי מטבחים</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {CUISINES.map((cuisine) => (
            <button
              key={cuisine}
              onClick={() => setActiveCuisine(cuisine)}
              aria-pressed={activeCuisine === cuisine}
              className={cn(
                "group relative overflow-hidden rounded-3xl h-28 transition-all active:scale-95 border-2",
                activeCuisine === cuisine
                  ? "border-primary-500 bg-primary-50 dark:bg-primary-900/10 shadow-lg shadow-primary-100 dark:shadow-none"
                  : "border-transparent bg-[var(--card)] shadow-sm hover:shadow-md hover:border-primary-200"
              )}
            >
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <span className={cn(
                  "font-bold text-lg transition-colors",
                  activeCuisine === cuisine ? "text-primary-700 dark:text-primary-400" : "text-stone-600 dark:text-stone-300"
                )}>
                  {cuisine}
                </span>
                {activeCuisine === cuisine && (
                  <motion.div layoutId="cuisine-indicator" className="w-1.5 h-1.5 rounded-full bg-primary-500" aria-hidden="true" />
                )}
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-12">
        <div className="flex flex-wrap items-center justify-center gap-3" role="group" aria-label="סינון לפי קטגוריה" data-tour="categories">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              aria-pressed={activeCategory === cat}
              className={cn(
                "px-6 py-2.5 rounded-full text-sm font-bold transition-all active:scale-95",
                activeCategory === cat
                  ? "bg-primary-500 text-white shadow-lg shadow-primary-200 dark:shadow-none"
                  : "bg-[var(--card)] text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 border border-[var(--border)] shadow-sm"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" aria-busy="true" aria-label="טוען מתכונים">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-[var(--card)] rounded-3xl aspect-[4/5] animate-pulse border border-[var(--border)]" />
            ))}
          </div>
        ) : filteredRecipes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredRecipes.map(recipe => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-[var(--card)] rounded-[3rem] border border-[var(--border)] shadow-inner">
            <div className="bg-stone-100 dark:bg-stone-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" aria-hidden="true">
              <Utensils className="w-10 h-10 text-stone-300 dark:text-stone-600" />
            </div>
            <p className="text-stone-500 dark:text-stone-400 font-medium font-serif italic text-2xl">לא נמצאו מתכונים התואמים לחיפוש שלך.</p>
          </div>
        )}
      </div>
    </div>
  );
}
