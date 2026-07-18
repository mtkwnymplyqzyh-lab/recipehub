import { supabase } from './supabase';
import { Ingredient, Recipe, RecipeInput, UserProfile } from '../types';

// --- Row types (DB shape) ---

interface ProfileRow {
  id: string;
  display_name: string;
  photo_url: string | null;
  bio: string | null;
  created_at: string;
}

interface RecipeRow {
  id: string;
  author_id: string;
  title: string;
  description: string;
  prep_time: number;
  category: string;
  cuisine: string | null;
  secret_tip: string | null;
  image_url: string | null;
  is_public: boolean;
  ingredients: Ingredient[];
  instructions: string[];
  likes_count: number;
  created_at: string;
  updated_at: string;
  profiles: { display_name: string } | null;
}

// Disambiguated with !author_id: PostgREST reports PGRST201 ("more than one
// relationship was found") without this hint once more than one FK path
// exists between recipes and profiles.
const RECIPE_SELECT = '*, profiles!author_id(display_name)';

function mapRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.profiles?.display_name ?? 'שף',
    title: row.title,
    description: row.description,
    ingredients: row.ingredients,
    instructions: row.instructions,
    prepTime: row.prep_time,
    imageUrl: row.image_url ?? undefined,
    category: row.category,
    cuisine: row.cuisine ?? undefined,
    secretTip: row.secret_tip ?? undefined,
    isPublic: row.is_public,
    likesCount: row.likes_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProfile(row: ProfileRow): UserProfile {
  return {
    userId: row.id,
    displayName: row.display_name,
    photoURL: row.photo_url ?? undefined,
    bio: row.bio ?? undefined,
    createdAt: row.created_at,
  };
}

function toRecipeRow(input: RecipeInput) {
  return {
    title: input.title,
    description: input.description,
    prep_time: input.prepTime,
    category: input.category,
    cuisine: input.cuisine || null,
    secret_tip: input.secretTip || null,
    image_url: input.imageUrl || null,
    is_public: input.isPublic,
    ingredients: input.ingredients,
    instructions: input.instructions,
  };
}

// --- Recipes ---

export async function getRecipes(category?: string): Promise<Recipe[]> {
  let query = supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(20);
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as RecipeRow[]).map(mapRecipe);
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  const { data, error } = await supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRecipe(data as unknown as RecipeRow) : null;
}

export async function getUserRecipes(userId: string, includePrivate: boolean): Promise<Recipe[]> {
  let query = supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .eq('author_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (!includePrivate) query = query.eq('is_public', true);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as RecipeRow[]).map(mapRecipe);
}

export async function createRecipe(authorId: string, input: RecipeInput): Promise<string> {
  const { data, error } = await supabase
    .from('recipes')
    .insert({ ...toRecipeRow(input), author_id: authorId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateRecipe(id: string, input: RecipeInput): Promise<void> {
  const { error } = await supabase.from('recipes').update(toRecipeRow(input)).eq('id', id);
  if (error) throw error;
}

export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) throw error;
}

// --- Favorites ---

export async function isFavorite(userId: string, recipeId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('favorites')
    .select('recipe_id')
    .eq('user_id', userId)
    .eq('recipe_id', recipeId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function toggleFavorite(
  userId: string,
  recipeId: string,
  currentlyFavorite: boolean
): Promise<void> {
  if (currentlyFavorite) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('recipe_id', recipeId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('favorites')
      .insert({ user_id: userId, recipe_id: recipeId });
    if (error) throw error;
  }
}

export async function getFavoriteRecipes(userId: string): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select(`recipes(${RECIPE_SELECT})`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as { recipes: RecipeRow | null }[])
    .map(row => row.recipes)
    .filter((r): r is RecipeRow => r !== null)
    .map(mapRecipe);
}

// --- Profiles ---

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data as ProfileRow) : null;
}

export async function updateProfile(
  userId: string,
  changes: { displayName: string; bio: string; photoURL: string }
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: changes.displayName,
      bio: changes.bio || null,
      photo_url: changes.photoURL || null,
    })
    .eq('id', userId);
  if (error) throw error;
}

// --- Storage ---

export async function uploadRecipeImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('recipe-images').upload(path, file);
  if (error) throw error;
  return supabase.storage.from('recipe-images').getPublicUrl(path).data.publicUrl;
}
