# Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Firebase (Auth + Firestore) with Supabase (Auth + Postgres + Storage) across RecipeHub, per `docs/superpowers/specs/2026-07-17-supabase-migration-design.md`.

**Architecture:** All data access goes through a typed layer `src/lib/api.ts`; pages never import the Supabase client directly. Auth state lives in `AuthContext` with the same public interface as today. Likes are a DB-maintained counter (`likes_count` + trigger). Images go to Supabase Storage.

**Tech Stack:** React 19, Vite 6, TypeScript, `@supabase/supabase-js` v2. Firebase is fully removed.

## Global Constraints

- UI text is Hebrew; the app renders with `dir="rtl"`. Do not change styling/layout except where a task says so.
- No test infrastructure exists in this project. Verification per task = `npm run lint` (this runs `tsc --noEmit`) passing clean, plus the manual checks listed in the task. Full manual E2E happens in Task 9.
- `src/lib/api.ts` is the ONLY file that imports from `src/lib/supabase.ts` (besides `AuthContext.tsx`, which needs `supabase.auth`).
- Zero `any` in new/modified data-layer code.
- The user-facing field names stay camelCase in TypeScript (`prepTime`, `imageUrl`, ...); DB columns are snake_case. Mapping happens only inside `api.ts`.
- Commit after every task with the trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Supabase schema file + project setup

**Files:**
- Create: `supabase/schema.sql`
- Modify: `.env.example` (replace Firebase vars), `.env.local` (user fills real values)

**Interfaces:**
- Produces: Postgres tables `profiles`, `recipes`, `favorites`; storage bucket `recipe-images`; env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` consumed by Task 2.

- [ ] **Step 1: Write `supabase/schema.sql`** with exactly this content:

```sql
-- RecipeHub schema. Run once in the Supabase SQL Editor.

-- === Tables ===

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  photo_url text,
  bio text check (bio is null or char_length(bio) < 500),
  created_at timestamptz not null default now()
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null check (char_length(description) < 2000),
  prep_time int not null check (prep_time >= 1),
  category text not null check (char_length(category) between 1 and 100),
  cuisine text check (cuisine is null or char_length(cuisine) <= 100),
  secret_tip text check (secret_tip is null or char_length(secret_tip) <= 1000),
  image_url text,
  is_public boolean not null default true,
  ingredients jsonb not null check (jsonb_array_length(ingredients) between 1 and 100),
  instructions jsonb not null check (jsonb_array_length(instructions) between 1 and 50),
  likes_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create index recipes_public_created_idx on public.recipes (is_public, created_at desc);
create index recipes_author_idx on public.recipes (author_id);
create index recipes_category_idx on public.recipes (category);

-- === Triggers ===

-- Auto-create a profile row when a user signs up (Google metadata).
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, photo_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'שף'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Maintain recipes.likes_count from favorites. Clients never write it.
create function public.bump_likes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.recipes set likes_count = likes_count + 1 where id = new.recipe_id;
    return new;
  else
    update public.recipes set likes_count = greatest(0, likes_count - 1) where id = old.recipe_id;
    return old;
  end if;
end; $$;

create trigger on_favorite_change
  after insert or delete on public.favorites
  for each row execute function public.bump_likes();

-- Keep updated_at fresh.
create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

create trigger recipes_touch_updated_at
  before update on public.recipes
  for each row execute function public.touch_updated_at();

-- === Row Level Security ===

alter table public.profiles enable row level security;
alter table public.recipes enable row level security;
alter table public.favorites enable row level security;

-- profiles: public read (only display_name/photo/bio are exposed; needed so
-- anonymous visitors see recipe author names). Update self only. No client insert (trigger only).
create policy "profiles are readable by everyone"
  on public.profiles for select using (true);
create policy "users update own profile"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- recipes: public ones readable by everyone, private ones by their author.
create policy "public recipes are readable"
  on public.recipes for select using (is_public or auth.uid() = author_id);
create policy "authors insert own recipes"
  on public.recipes for insert with check (auth.uid() = author_id);
create policy "authors update own recipes"
  on public.recipes for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "authors delete own recipes"
  on public.recipes for delete using (auth.uid() = author_id);

-- likes_count is trigger-maintained; block clients from touching it directly is
-- not expressible per-column in RLS, so the API layer never sends it and the
-- update policy above already restricts updates to the author.

-- favorites: strictly private.
create policy "users read own favorites"
  on public.favorites for select using (auth.uid() = user_id);
create policy "users add own favorites"
  on public.favorites for insert with check (auth.uid() = user_id);
create policy "users remove own favorites"
  on public.favorites for delete using (auth.uid() = user_id);

-- === Storage ===

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

create policy "recipe images are publicly readable"
  on storage.objects for select using (bucket_id = 'recipe-images');
create policy "users upload to own folder"
  on storage.objects for insert
  with check (bucket_id = 'recipe-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "users delete own images"
  on storage.objects for delete
  using (bucket_id = 'recipe-images' and auth.uid()::text = (storage.foldername(name))[1]);
```

- [ ] **Step 2: Replace `.env.example` content** with:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

- [ ] **Step 3: USER ACTION (Daniel)** — guided by the executor, outside of code:
  1. Create a project at https://supabase.com/dashboard (region: closest, e.g. Frankfurt/eu-central).
  2. SQL Editor → paste `supabase/schema.sql` → Run. Expected: "Success. No rows returned".
  3. Google Cloud Console → create OAuth 2.0 Client ID (Web). Authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.
  4. Supabase → Authentication → Providers → Google → paste Client ID + Secret → enable.
  5. Supabase → Authentication → URL Configuration → Site URL: `http://localhost:3000`.
  6. Project Settings → API → copy Project URL and anon public key into `.env.local` as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (keep the old Firebase lines for now; they are removed in Task 9).

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql .env.example
git commit -m "feat: add Supabase schema (tables, RLS, triggers, storage)"
```

---

### Task 2: Supabase client, dependencies, and types

**Files:**
- Create: `src/lib/supabase.ts`
- Modify: `src/types.ts` (full rewrite), `package.json` (via npm)

**Interfaces:**
- Produces: `supabase` client export; types `UserProfile`, `Ingredient`, `Recipe`, `RecipeInput` used by every later task.

- [ ] **Step 1: Install/remove dependencies**

```bash
npm uninstall firebase
npm install @supabase/supabase-js
```

Expected: both commands exit 0. (`npm run lint` will now FAIL — firebase imports still exist in old files. That is expected until Tasks 4–8 remove them; do not run lint as a gate again until Task 4 says so.)

- [ ] **Step 2: Create `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local');
}

export const supabase = createClient(url, anonKey);
```

- [ ] **Step 3: Rewrite `src/types.ts`** to exactly:

```ts
export interface UserProfile {
  userId: string;
  displayName: string;
  email?: string; // only known for the signed-in user (comes from auth, not the DB)
  photoURL?: string;
  bio?: string;
  createdAt: string;
}

export type Category = string;

export interface Ingredient {
  name: string;
  amount?: string;
  unit?: string;
}

export interface Recipe {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  description: string;
  ingredients: Ingredient[];
  instructions: string[];
  prepTime: number;
  imageUrl?: string;
  category: Category;
  cuisine?: string;
  secretTip?: string;
  isPublic: boolean;
  likesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeInput {
  title: string;
  description: string;
  prepTime: number;
  category: string;
  cuisine: string;
  secretTip: string;
  imageUrl: string;
  isPublic: boolean;
  ingredients: Ingredient[];
  instructions: string[];
}
```

Note: `OperationType`, `FirestoreErrorInfo`, `Favorite`, and the `(string | Ingredient)[]` union are deleted on purpose. Ingredients are always structured objects now (clean start, no legacy data).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/supabase.ts src/types.ts
git commit -m "feat: add Supabase client and rewritten types; drop firebase dependency"
```

---

### Task 3: Typed data layer `src/lib/api.ts`

**Files:**
- Create: `src/lib/api.ts`
- Delete: `src/lib/firestore.ts`

**Interfaces:**
- Consumes: `supabase` from Task 2; types from Task 2.
- Produces (exact signatures — later tasks call these):
  - `getRecipes(category?: string): Promise<Recipe[]>`
  - `getRecipe(id: string): Promise<Recipe | null>`
  - `getUserRecipes(userId: string, includePrivate: boolean): Promise<Recipe[]>`
  - `createRecipe(authorId: string, input: RecipeInput): Promise<string>` (returns new id)
  - `updateRecipe(id: string, input: RecipeInput): Promise<void>`
  - `deleteRecipe(id: string): Promise<void>`
  - `isFavorite(userId: string, recipeId: string): Promise<boolean>`
  - `toggleFavorite(userId: string, recipeId: string, currentlyFavorite: boolean): Promise<void>`
  - `getFavoriteRecipes(userId: string): Promise<Recipe[]>`
  - `getProfile(userId: string): Promise<UserProfile | null>`
  - `updateProfile(userId: string, changes: { displayName: string; bio: string; photoURL: string }): Promise<void>`
  - `uploadRecipeImage(userId: string, file: File): Promise<string>` (returns public URL)

- [ ] **Step 1: Create `src/lib/api.ts`**

```ts
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

const RECIPE_SELECT = '*, profiles(display_name)';

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
```

- [ ] **Step 2: Delete `src/lib/firestore.ts`**

```bash
git rm src/lib/firestore.ts
```

- [ ] **Step 3: Commit** (lint still red until Task 4+ — expected)

```bash
git add src/lib/api.ts
git commit -m "feat: typed Supabase data layer (api.ts); remove firestore helpers"
```

---

### Task 4: Rewrite `AuthContext`

**Files:**
- Modify: `src/contexts/AuthContext.tsx` (full rewrite)
- Delete: `src/lib/firebase.ts`

**Interfaces:**
- Consumes: `supabase` (Task 2), `getProfile` (Task 3).
- Produces: `useAuth(): { user: User | null; profile: UserProfile | null; loading: boolean; signIn(): Promise<void>; logout(): Promise<void> }` where `User` is `@supabase/supabase-js`'s User. **Breaking change for consumers: `user.uid` → `user.id`** (fixed per page in Tasks 6–8).

- [ ] **Step 1: Rewrite `src/contexts/AuthContext.tsx`** to exactly:

```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getProfile } from '../lib/api';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async (nextUser: User | null) => {
      if (!nextUser) {
        if (!cancelled) setProfile(null);
        return;
      }
      try {
        const p = await getProfile(nextUser.id);
        if (!cancelled && p) setProfile({ ...p, email: nextUser.email ?? undefined });
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
    };

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const nextUser = session?.user ?? null;
      if (!cancelled) setUser(nextUser);
      await loadProfile(nextUser);
      if (!cancelled) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      loadProfile(nextUser);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

Notes baked into this design: `setLoading(false)` runs even when profile fetch fails (fixes the infinite-spinner bug); profile row is created by the DB trigger, not the client.

- [ ] **Step 2: Delete `src/lib/firebase.ts`**

```bash
git rm src/lib/firebase.ts
```

- [ ] **Step 3: Typecheck** — `npm run lint`. Expected: errors ONLY in `useRecipes.ts`, `Home.tsx`, `CreateRecipe.tsx`, `RecipeDetail.tsx`, `Profile.tsx` (they still reference firebase/`user.uid`/old types). No errors in `AuthContext.tsx`, `api.ts`, `supabase.ts`, `Navbar.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/contexts/AuthContext.tsx
git commit -m "feat: Supabase auth in AuthContext (Google OAuth, resilient profile load)"
```

---

### Task 5: Rewrite `useRecipes` hook

**Files:**
- Modify: `src/hooks/useRecipes.ts` (full rewrite)

**Interfaces:**
- Consumes: `getRecipes`, `getUserRecipes` (Task 3).
- Produces: `useRecipes(): { recipes, loading, fetchRecipes(category?: string) }` and `useUserRecipes(userId: string, isOwner?: boolean): { recipes, loading }` — same shape as today, so `Home.tsx`/`Profile.tsx` call sites keep working.

- [ ] **Step 1: Rewrite `src/hooks/useRecipes.ts`** to exactly:

```ts
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
```

- [ ] **Step 2: Fix `Home.tsx` ingredient search** — in `src/pages/Home.tsx`, the filter at lines 41–48 handles `string | Ingredient`. Replace the `matchesSearch` block with:

```ts
    const matchesSearch =
      r.title.toLowerCase().includes(q) ||
      r.ingredients.some(i => i.name.toLowerCase().includes(q));
```

No other change in `Home.tsx`.

- [ ] **Step 3: Typecheck** — `npm run lint`. Expected: remaining errors only in `CreateRecipe.tsx`, `RecipeDetail.tsx`, `Profile.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useRecipes.ts src/pages/Home.tsx
git commit -m "feat: useRecipes hooks on Supabase api layer"
```

---

### Task 6: Migrate `CreateRecipe` page

**Files:**
- Modify: `src/pages/CreateRecipe.tsx`

**Interfaces:**
- Consumes: `getRecipe`, `createRecipe`, `updateRecipe`, `uploadRecipeImage` (Task 3); `user.id` (Task 4); `Ingredient`, `RecipeInput` (Task 2).

The page keeps its exact UI. Only data plumbing changes:

- [ ] **Step 1: Replace imports** — remove the firebase/firestore imports (lines 4–5, 7–8: `db`, `doc/getDoc/...`, `handleFirestoreError`, `OperationType`) and import instead:

```ts
import { getRecipe, createRecipe, updateRecipe, uploadRecipeImage } from '../lib/api';
import { Recipe, Ingredient } from '../types';
```

Also swap the icon import `ArrowLeft` → `ArrowRight` (RTL fix) and update its JSX usage (`<ArrowLeft className="w-4 h-4" />` → `<ArrowRight className="w-4 h-4" />`).

- [ ] **Step 2: Type the form state** — change `ingredients: [{ name: '', amount: '', unit: '' }]` state declaration so ingredients are `Ingredient[]`:

```ts
const [formData, setFormData] = useState<{
  title: string; description: string; prepTime: number; category: string;
  cuisine: string; secretTip: string; imageUrl: string; isPublic: boolean;
  ingredients: Ingredient[]; instructions: string[];
}>({
  title: '', description: '', prepTime: 30,
  category: DEFAULT_CATEGORIES[0], cuisine: DEFAULT_CUISINES[0],
  secretTip: '', imageUrl: '', isPublic: true,
  ingredients: [{ name: '', amount: '', unit: '' }],
  instructions: ['']
});
```

Remove the `as any[]` on `formattedIngredients` and the string-legacy mapping (`typeof ing === 'string'` branch) — ingredients are always objects now. In the fetch effect, replace the `getDoc` logic with:

```ts
useEffect(() => {
  if (!id) return;
  const fetchRecipe = async () => {
    setFetching(true);
    try {
      const data = await getRecipe(id);
      if (!data || data.authorId !== user?.id) {
        navigate('/');
        return;
      }
      const isStandard = DEFAULT_CATEGORIES.includes(data.category);
      const isStandardCuisine = DEFAULT_CUISINES.includes(data.cuisine || '');
      setFormData({
        title: data.title,
        description: data.description,
        prepTime: data.prepTime,
        category: isStandard ? data.category : 'אחר',
        cuisine: isStandardCuisine ? (data.cuisine || DEFAULT_CUISINES[0]) : 'אחר',
        secretTip: data.secretTip || '',
        imageUrl: data.imageUrl || '',
        isPublic: data.isPublic,
        ingredients: data.ingredients,
        instructions: data.instructions
      });
      if (!isStandard) { setShowCustomCategory(true); setCustomCategory(data.category); }
      if (data.cuisine && !isStandardCuisine) { setShowCustomCuisine(true); setCustomCuisine(data.cuisine); }
    } catch (error) {
      console.error(error);
      toast('שגיאה בטעינת המתכון', 'error');
    } finally {
      setFetching(false);
    }
  };
  fetchRecipe();
}, [id, user, navigate]);
```

- [ ] **Step 3: Replace image upload with Storage** — replace `handleImageUpload`:

```ts
const [uploading, setUploading] = useState(false);

const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file || !user) return;
  if (file.size > 5 * 1024 * 1024) {
    toast('התמונה גדולה מדי. המגבלה היא 5MB', 'error');
    return;
  }
  setUploading(true);
  try {
    const url = await uploadRecipeImage(user.id, file);
    setFormData(prev => ({ ...prev, imageUrl: url }));
  } catch (err) {
    console.error(err);
    toast('שגיאה בהעלאת התמונה', 'error');
  } finally {
    setUploading(false);
  }
};
```

In the image `<section>`, show a small spinner next to the "בחירה" label while `uploading` is true (reuse the existing spinner div pattern: `<div className="w-3.5 h-3.5 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />`).

- [ ] **Step 4: Rewrite `handleSubmit`** — with cuisine validation added (bug fix) and no `any`:

```ts
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!user || !profile) return;

  if (formData.category === 'אחר' && !customCategory.trim()) {
    toast('אנא הזינו שם קטגוריה', 'error');
    return;
  }
  if (formData.cuisine === 'אחר' && !customCuisine.trim()) {
    toast('אנא הזינו סוג מטבח', 'error');
    return;
  }

  setLoading(true);
  try {
    const input = {
      title: formData.title,
      description: formData.description,
      prepTime: formData.prepTime,
      category: formData.category === 'אחר' ? customCategory.trim() : formData.category,
      cuisine: formData.cuisine === 'אחר' ? customCuisine.trim() : formData.cuisine,
      secretTip: formData.secretTip,
      imageUrl: formData.imageUrl,
      isPublic: formData.isPublic,
      ingredients: formData.ingredients,
      instructions: formData.instructions,
    };
    if (id) {
      await updateRecipe(id, input);
      toast('המתכון עודכן בהצלחה!');
    } else {
      await createRecipe(user.id, input);
      toast('המתכון נוצר בהצלחה!');
    }
    navigate('/profile');
  } catch (error) {
    console.error(error);
    toast('שגיאה בשמירת המתכון', 'error');
  } finally {
    setLoading(false);
  }
};
```

Also update the two list-item helpers to be typed (replace the `value: any` and `as any` versions):

```ts
const handleInstructionChange = (index: number, value: string) => {
  const instructions = [...formData.instructions];
  instructions[index] = value;
  setFormData({ ...formData, instructions });
};

const handleIngredientChange = (index: number, field: keyof Ingredient, value: string) => {
  const ingredients = [...formData.ingredients];
  ingredients[index] = { ...ingredients[index], [field]: value };
  setFormData({ ...formData, ingredients });
};
```

Update JSX call sites accordingly: instructions textarea uses `handleInstructionChange(i, e.target.value)`; the ingredient map drops `(ing: any, i)` in favor of `(ing, i)`.

- [ ] **Step 5: Typecheck** — `npm run lint`. Expected: remaining errors only in `RecipeDetail.tsx`, `Profile.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/CreateRecipe.tsx
git commit -m "feat: CreateRecipe on Supabase (storage upload, cuisine validation, RTL arrow)"
```

---

### Task 7: Migrate `RecipeDetail` page

**Files:**
- Modify: `src/pages/RecipeDetail.tsx`

**Interfaces:**
- Consumes: `getRecipe`, `isFavorite`, `toggleFavorite`, `deleteRecipe` (Task 3); `user.id` (Task 4).

- [ ] **Step 1: Replace imports** — drop `firebase/firestore` and `db`; add:

```ts
import { getRecipe, isFavorite as fetchIsFavorite, toggleFavorite, deleteRecipe } from '../lib/api';
```

Swap `ArrowLeft` → `ArrowRight` (import + JSX).

- [ ] **Step 2: Rewrite the fetch effect**:

```ts
useEffect(() => {
  if (!id) return;
  let cancelled = false;
  const fetchData = async () => {
    try {
      const [recipeData, fav] = await Promise.all([
        getRecipe(id),
        user ? fetchIsFavorite(user.id, id) : Promise.resolve(false),
      ]);
      if (cancelled) return;
      if (recipeData) {
        setRecipe(recipeData);
        setIsFavorite(fav);
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!cancelled) setLoading(false);
    }
  };
  fetchData();
  return () => { cancelled = true; };
}, [id, user, navigate]);
```

- [ ] **Step 3: Rewrite `handleLike`** — no transaction needed; the DB trigger maintains the count:

```ts
const handleLike = async () => {
  if (!user || !recipe || !id) {
    toast('אנא התחברו כדי לשמור מתכונים למועדפים', 'error');
    return;
  }
  const wasFavorite = isFavorite;
  try {
    await toggleFavorite(user.id, id, wasFavorite);
    setIsFavorite(!wasFavorite);
    setRecipe(prev => prev ? {
      ...prev,
      likesCount: wasFavorite ? Math.max(0, prev.likesCount - 1) : prev.likesCount + 1
    } : null);
  } catch (err) {
    console.error(err);
    toast('שגיאה בעדכון המועדפים', 'error');
  }
};
```

- [ ] **Step 4: Rewrite `handleDelete`**:

```ts
const handleDelete = async () => {
  if (!id) return;
  try {
    await deleteRecipe(id);
    toast('המתכון נמחק');
    navigate('/profile');
  } catch (err) {
    console.error(err);
    toast('שגיאה במחיקת המתכון', 'error');
  }
};
```

- [ ] **Step 5: Simplify ingredient rendering** — ingredients are always `Ingredient` objects now. Replace the `typeof ing === 'string'` branches (lines ~181–190) with:

```tsx
<span className="font-bold">{ing.name}</span>
...
{(ing.amount || ing.unit) && (
  <div className="flex items-center gap-1 bg-white dark:bg-stone-800 px-3 py-1 rounded-xl border border-stone-100 dark:border-stone-700 text-xs font-bold text-stone-500 dark:text-stone-400">
    {ing.amount && <span>{ing.amount}</span>}
    {ing.unit && <span>{ing.unit}</span>}
  </div>
)}
```

Also `isAuthor` becomes `user?.id === recipe.authorId`, and `recipe.likesCount || 0` can stay as-is.

- [ ] **Step 6: Typecheck** — `npm run lint`. Expected: remaining errors only in `Profile.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/pages/RecipeDetail.tsx
git commit -m "feat: RecipeDetail on Supabase (trigger-backed likes, RTL arrow)"
```

---

### Task 8: Migrate `Profile` page

**Files:**
- Modify: `src/pages/Profile.tsx`

**Interfaces:**
- Consumes: `getProfile`, `updateProfile`, `getFavoriteRecipes` (Task 3); `user.id` (Task 4).

- [ ] **Step 1: Replace imports** — drop `firebase/firestore` + `db`; add:

```ts
import { getProfile, updateProfile, getFavoriteRecipes } from '../lib/api';
```

- [ ] **Step 2: Update id derivation** — `const id = userId || currentUser?.id;`

- [ ] **Step 3: Rewrite the profile fetch effect**:

```ts
useEffect(() => {
  if (!id) return;
  if (isOwnProfile && currentProfile) {
    setProfile(currentProfile);
    return;
  }
  getProfile(id)
    .then(p => { if (p) setProfile(p); })
    .catch(err => console.error(err));
}, [id, isOwnProfile, currentProfile]);
```

- [ ] **Step 4: Rewrite the favorites effect**:

```ts
useEffect(() => {
  if (!id || activeTab !== 'favorites') return;
  let cancelled = false;
  setLoadingFavs(true);
  getFavoriteRecipes(id)
    .then(r => { if (!cancelled) setFavRecipes(r); })
    .catch(err => console.error(err))
    .finally(() => { if (!cancelled) setLoadingFavs(false); });
  return () => { cancelled = true; };
}, [id, activeTab]);
```

- [ ] **Step 5: Rewrite `handleUpdateProfile`**:

```ts
const handleUpdateProfile = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!currentUser) return;
  setSaving(true);
  try {
    await updateProfile(currentUser.id, {
      displayName: editForm.displayName,
      bio: editForm.bio,
      photoURL: editForm.photoURL,
    });
    setProfile(prev => prev ? { ...prev, ...editForm } : null);
    setIsEditing(false);
  } catch (err) {
    console.error(err);
    toast('שגיאה בעדכון הפרופיל', 'error');
  } finally {
    setSaving(false);
  }
};
```

(Import `toast` from `'../components/ui/Toaster'` — replaces the `alert()`.)

- [ ] **Step 6: Typecheck** — `npm run lint`. Expected: **zero errors project-wide.**

- [ ] **Step 7: Commit**

```bash
git add src/pages/Profile.tsx
git commit -m "feat: Profile on Supabase (profiles table, favorites join)"
```

---

### Task 9: Cleanup + full manual E2E

**Files:**
- Delete: `firestore.rules`, `firebase-blueprint.json`, `firebase-applet-config.json`
- Modify: `.env.local` (remove `VITE_FIREBASE_*` lines), `README.md` (setup section)

- [ ] **Step 1: Remove Firebase leftovers**

```bash
git rm firestore.rules firebase-blueprint.json
rm -f firebase-applet-config.json
```

Edit `.env.local`: delete all `VITE_FIREBASE_*` lines, keep only the two Supabase vars.

- [ ] **Step 2: Verify no firebase references remain**

Run: `grep -ri "firebase" src/ index.html package.json` — Expected: no matches.

- [ ] **Step 3: Update `README.md`** — replace the "Run Locally" prerequisites: remove the Gemini/AI-Studio references, document `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` in `.env.local` and `supabase/schema.sql` as the DB setup step.

- [ ] **Step 4: Typecheck + build**

```bash
npm run lint && npm run build
```

Expected: both pass clean.

- [ ] **Step 5: Manual E2E** (`npm run dev`, browser at http://localhost:3000):
  1. Anonymous: home page loads, empty state renders (no recipes yet).
  2. התחברות with Google → redirected back, navbar shows name + avatar.
  3. Create a recipe with an uploaded image (file), custom category "אחר", 2 ingredients, 2 steps → lands on profile, recipe visible.
  4. Home shows the recipe; category filter + search by ingredient work.
  5. Recipe page: like → counter 1; unlike → 0; like again → 1.
  6. Profile → מועדפים tab shows the liked recipe.
  7. Edit the recipe (change title) → saved.
  8. Update profile bio → persists after refresh.
  9. Create a private recipe (גלוי לכולם off) → visible in own profile, NOT on home; open its URL in incognito → redirected home.
  10. Delete a recipe → gone from home + favorites.
  11. התנתקות → navbar shows התחברות; liked/private content inaccessible.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: remove Firebase artifacts, update README for Supabase"
```
