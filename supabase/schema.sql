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