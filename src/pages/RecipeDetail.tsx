import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Recipe } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Clock, ChefHat, Heart, ArrowLeft, Edit2, Trash2, CheckCircle2, User, Utensils, Sparkles, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from '../components/ui/Toaster';

export function RecipeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const recipePromise = getDoc(doc(db, 'recipes', id));
        const favPromise = user
          ? getDoc(doc(db, 'users', user.uid, 'favorites', id))
          : Promise.resolve(null);

        const [docSnap, favSnap] = await Promise.all([recipePromise, favPromise]);

        if (docSnap.exists()) {
          setRecipe({ id: docSnap.id, ...docSnap.data() } as Recipe);
        } else {
          navigate('/');
        }
        if (favSnap) setIsFavorite(favSnap.exists());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user, navigate]);

  const handleLike = async () => {
    if (!user || !recipe || !id) {
      toast('אנא התחברו כדי לשמור מתכונים למועדפים', 'error');
      return;
    }

    const favRef = doc(db, 'users', user.uid, 'favorites', id);
    const recipeRef = doc(db, 'recipes', id);
    const wasAlreadyFavorite = isFavorite;

    try {
      await runTransaction(db, async (transaction) => {
        const recipeSnap = await transaction.get(recipeRef);
        if (!recipeSnap.exists()) throw new Error('Recipe not found');

        const currentCount = recipeSnap.data().likesCount || 0;

        if (wasAlreadyFavorite) {
          transaction.delete(favRef);
          transaction.update(recipeRef, { likesCount: Math.max(0, currentCount - 1) });
        } else {
          transaction.set(favRef, { createdAt: new Date().toISOString(), recipeId: id });
          transaction.update(recipeRef, { likesCount: currentCount + 1 });
        }
      });

      setIsFavorite(!wasAlreadyFavorite);
      setRecipe(prev => prev ? {
        ...prev,
        likesCount: wasAlreadyFavorite
          ? Math.max(0, (prev.likesCount || 1) - 1)
          : (prev.likesCount || 0) + 1
      } : null);
    } catch (err) {
      toast('שגיאה בעדכון המועדפים', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'recipes', id!));
      toast('המתכון נמחק');
      navigate('/profile');
    } catch (err) {
      toast('שגיאה במחיקת המתכון', 'error');
    }
  };

  if (loading) return null;
  if (!recipe) return null;

  const isAuthor = user?.uid === recipe.authorId;

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/')}
          className="flex items-center gap-2 text-stone-500 hover:text-stone-900 font-medium transition-colors"
          aria-label="חזרה לעמוד הקודם"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          חזרה
        </button>

        {isAuthor && (
          <div className="flex items-center gap-4">
            <Link
              to={`/edit/${recipe.id}`}
              className="p-2 bg-[var(--card)] border border-[var(--border)] rounded-xl hover:bg-primary-50 transition-colors"
              aria-label="עריכת מתכון"
            >
              <Edit2 className="w-5 h-5 text-stone-600" aria-hidden="true" />
            </Link>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-stone-500 font-medium">למחוק?</span>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-colors"
                  aria-label="אישור מחיקת מתכון"
                >
                  מחק
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 bg-stone-100 text-stone-600 text-sm font-bold rounded-xl hover:bg-stone-200 transition-colors"
                  aria-label="ביטול מחיקה"
                >
                  ביטול
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 bg-[var(--card)] border border-[var(--border)] rounded-xl hover:bg-red-50 group transition-colors"
                aria-label="מחיקת מתכון"
              >
                <Trash2 className="w-5 h-5 text-stone-400 group-hover:text-red-500" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
        >
          <div className="aspect-[4/3] rounded-[3rem] overflow-hidden bg-stone-100 dark:bg-stone-800 shadow-2xl shadow-primary-100 dark:shadow-none border-8 border-[var(--card)]">
            {recipe.imageUrl ? (
              <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-200 dark:text-stone-700" aria-label="אין תמונה למתכון">
                <ChefHat className="w-24 h-24" aria-hidden="true" />
              </div>
            )}
          </div>

          <div className="bg-[var(--card)] p-8 rounded-3xl border border-[var(--border)] shadow-sm space-y-6">
            <h2 className="font-serif text-2xl font-bold text-[var(--foreground)] flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center" aria-hidden="true">
                <CheckCircle2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </span>
              רכיבים
            </h2>
            <ul className="space-y-3">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-stone-600 dark:text-stone-300 font-medium bg-stone-50/50 dark:bg-stone-900/50 p-4 rounded-2xl border border-transparent hover:border-primary-100 dark:hover:border-primary-900/10 transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-2 h-2 rounded-full bg-primary-400" aria-hidden="true" />
                    <span className="font-bold">
                      {typeof ing === 'string' ? ing : ing.name}
                    </span>
                  </div>
                  {typeof ing !== 'string' && (ing.amount || ing.unit) && (
                    <div className="flex items-center gap-1 bg-white dark:bg-stone-800 px-3 py-1 rounded-xl border border-stone-100 dark:border-stone-700 text-xs font-bold text-stone-500 dark:text-stone-400">
                      {ing.amount && <span>{ing.amount}</span>}
                      {ing.unit && <span>{ing.unit}</span>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-10"
        >
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/30 px-3 py-1 rounded-full">
                {recipe.category}
              </span>
              {recipe.cuisine && (
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-3 py-1 rounded-full">
                  <MapPin className="w-3 h-3" aria-hidden="true" />
                  {recipe.cuisine}
                </span>
              )}
              <div className="flex items-center gap-1.5 text-stone-400 dark:text-stone-500 text-sm font-medium">
                <Clock className="w-4 h-4" aria-hidden="true" />
                {recipe.prepTime} דק׳
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="font-serif text-5xl md:text-6xl font-bold leading-tight text-[var(--foreground)]">{recipe.title}</h1>
              <p className="text-stone-500 dark:text-stone-400 text-lg leading-relaxed font-medium prose prose-stone dark:prose-invert italic">{recipe.description}</p>
            </div>

            {recipe.secretTip && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-accent-50 dark:bg-accent-950/20 border border-accent-100 dark:border-accent-950/30 p-6 rounded-[2rem] space-y-3 relative overflow-hidden"
              >
                <div className="flex items-center gap-2 text-accent-700 dark:text-accent-400 font-bold uppercase tracking-wider text-xs">
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  הסוד של המנה / טיפ מנצח
                </div>
                <p className="text-accent-900 dark:text-accent-200 font-serif italic text-lg leading-relaxed relative z-10">
                  {recipe.secretTip}
                </p>
                <Sparkles className="absolute -bottom-4 -right-4 w-24 h-24 text-accent-200/30 dark:text-accent-400/10 -rotate-12" aria-hidden="true" />
              </motion.div>
            )}

            <div className="flex items-center gap-6 pt-4 border-t border-[var(--border)]">
              <Link to={`/profile/${recipe.authorId}`} className="flex items-center gap-3 group">
                <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center border-2 border-[var(--card)] shadow-sm group-hover:border-primary-500 transition-colors" aria-hidden="true">
                  <User className="w-6 h-6 text-stone-400 dark:text-stone-500 group-hover:text-primary-500 transition-colors" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 leading-none mb-1">יוצר/ת המתכון</p>
                  <p className="text-base font-bold text-[var(--foreground)] group-hover:text-primary-600 transition-colors">{recipe.authorName}</p>
                </div>
              </Link>
              <button
                onClick={handleLike}
                aria-label={isFavorite ? 'הסרה מהמועדפים' : 'הוספה למועדפים'}
                aria-pressed={isFavorite}
                className={cn(
                  "flex items-center gap-2 px-8 py-3 rounded-2xl font-bold transition-all border-2 active:scale-95",
                  isFavorite
                    ? "bg-accent-50 dark:bg-accent-900/20 border-accent-200 dark:border-accent-800/30 text-accent-700 dark:text-accent-400 shadow-xl shadow-accent-100 dark:shadow-none"
                    : "bg-[var(--card)] border-[var(--border)] text-stone-400 dark:text-stone-500 hover:border-stone-400 dark:hover:border-stone-600"
                )}
              >
                <Heart className={cn("w-5 h-5 transition-transform", isFavorite && "fill-current scale-110")} aria-hidden="true" />
                {recipe.likesCount || 0}
              </button>
            </div>
          </div>

          <div className="space-y-8">
            <h2 className="font-serif text-3xl font-bold text-[var(--foreground)] flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center border border-[var(--border)]" aria-hidden="true">
                <Utensils className="w-6 h-6 text-stone-500" />
              </span>
              אופן ההכנה
            </h2>
            <ol className="space-y-6">
              {recipe.instructions.map((step, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  key={i}
                  className="flex gap-6 group p-4 rounded-[2rem] hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors border border-transparent hover:border-[var(--border)]"
                >
                  <div className="flex-none pt-1">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-sm font-bold text-stone-400 group-hover:bg-primary-500 group-hover:text-white group-hover:border-primary-500 transition-all duration-300 shadow-sm" aria-hidden="true">
                      {i + 1}
                    </div>
                  </div>
                  <div className="pt-2">
                    <p className="text-stone-700 dark:text-stone-300 leading-relaxed font-serif text-lg">{step}</p>
                  </div>
                </motion.div>
              ))}
            </ol>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
