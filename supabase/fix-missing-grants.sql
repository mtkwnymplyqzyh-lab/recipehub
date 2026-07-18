grant select on public.profiles to anon, authenticated;
grant select on public.recipes to anon, authenticated;
grant delete on public.recipes to authenticated;
grant select, insert, delete on public.favorites to authenticated;

drop policy if exists "users add own favorites" on public.favorites;
create policy "users add own favorites"
  on public.favorites for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.recipes r
      where r.id = recipe_id and (r.is_public or r.author_id = auth.uid())
    )
  );
