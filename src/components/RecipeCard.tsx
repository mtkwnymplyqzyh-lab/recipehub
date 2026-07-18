import React from 'react';
import { Link } from 'react-router-dom';
import { Recipe } from '../types';
import { Clock, ChefHat, Heart } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface RecipeCardProps {
  recipe: Recipe;
}

export const RecipeCard = React.memo(function RecipeCard({ recipe }: RecipeCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="bg-[var(--card)] rounded-3xl overflow-hidden border border-[var(--border)] shadow-sm hover:shadow-xl transition-all group"
    >
      <Link
        to={`/recipe/${recipe.id}`}
        className="block relative aspect-[4/3] overflow-hidden"
        aria-label={`${recipe.title} - צפייה במתכון`}
      >
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-300 dark:text-stone-700" aria-label="אין תמונה למתכון">
            <ChefHat className="w-12 h-12" aria-hidden="true" />
          </div>
        )}
        <div className="absolute top-4 right-4 flex gap-2" aria-hidden="true">
          <span className="bg-white/90 dark:bg-stone-900/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-primary-700 dark:text-primary-400 shadow-sm">
            {recipe.category}
          </span>
          {recipe.cuisine && (
            <span className="bg-primary-500/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white shadow-sm">
              {recipe.cuisine}
            </span>
          )}
        </div>
      </Link>

      <div className="p-6">
        <Link to={`/profile/${recipe.authorId}`} className="flex items-center gap-2 mb-2 group/author w-fit">
          <img
            src={recipe.authorPhotoURL || '/default-avatar.png'}
            alt={recipe.authorName}
            className="w-5 h-5 rounded-full object-cover border border-primary-100"
          />
          <span className="text-xs uppercase tracking-widest font-bold text-primary-600 dark:text-primary-400 group-hover/author:underline">
            מאת {recipe.authorName}
          </span>
        </Link>
        <h3 className="font-serif text-xl font-bold text-[var(--foreground)] mb-2 group-hover:text-primary-600 transition-colors line-clamp-1">
          {recipe.title}
        </h3>
        <p className="text-stone-500 dark:text-stone-400 text-sm line-clamp-2 mb-4 h-10">
          {recipe.description}
        </p>

        <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-stone-400 dark:text-stone-500">
              <Clock className="w-4 h-4" aria-hidden="true" />
              <span className="text-xs font-medium">{recipe.prepTime} דק׳</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-accent-500 dark:text-accent-400" aria-label={`${recipe.likesCount || 0} לייקים`}>
            <Heart className="w-4 h-4 fill-current" aria-hidden="true" />
            <span className="text-xs font-medium">{recipe.likesCount || 0}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
});
