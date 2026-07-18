-- New users signing in without a Google profile photo get our chef
-- illustration as their default avatar instead of a blank photo_url.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, photo_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'שף'),
    coalesce(new.raw_user_meta_data->>'avatar_url', '/default-avatar.png')
  )
  on conflict (id) do nothing;
  return new;
end; $$;
