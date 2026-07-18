import { useState, useEffect, useCallback } from 'react';
import { Recipe } from '../types';
import { getRecipes, getUserRecipes } from '../lib/api';

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecipes = useCallback(async (category?: string) => {
    setLoading(true);
    try {
      setRecipes(await getRecipes(category === 'הכל' ? undefined : category));
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  return { recipes, loading, fetchRecipes };
}

export function useUserRecipes(userId: string, isOwner = false) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    getUserRecipes(userId, isOwner)
      .then(r => { if (!cancelled) setRecipes(r); })
      .catch(err => console.error('Failed to fetch user recipes:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, isOwner]);

  return { recipes, loading };
}
