import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Recipe } from '../types';
import { handleFirestoreError } from '../lib/firestore';
import { OperationType } from '../types';

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecipes = async (category?: string) => {
    setLoading(true);
    try {
      let q = query(
        collection(db, 'recipes'),
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      if (category && category !== 'הכל') {
        q = query(
          collection(db, 'recipes'),
          where('isPublic', '==', true),
          where('category', '==', category),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
      }

      const querySnapshot = await getDocs(q);
      const fetchedRecipes = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Recipe[];
      
      setRecipes(fetchedRecipes);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'recipes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  return { recipes, loading, fetchRecipes };
}

export function useUserRecipes(userId: string, isOwner = false) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const q = isOwner
          ? query(collection(db, 'recipes'), where('authorId', '==', userId), orderBy('createdAt', 'desc'), limit(50))
          : query(collection(db, 'recipes'), where('authorId', '==', userId), where('isPublic', '==', true), orderBy('createdAt', 'desc'), limit(50));
        const querySnapshot = await getDocs(q);
        setRecipes(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Recipe[]);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'recipes');
      } finally {
        setLoading(false);
      }
    };
    if (userId) fetch();
  }, [userId, isOwner]);

  return { recipes, loading };
}
