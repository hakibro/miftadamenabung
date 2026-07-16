-- Add username column for login without email domain
begin;

-- 1. Add username column (nullable initially)
alter table public.profiles
  add column if not exists username text;

-- 2. Populate existing rows: username = email prefix (before '@')
update public.profiles
  set username = split_part(email, '@', 1)
  where username is null;

-- 3. Enforce uniqueness and not-null after backfill
alter table public.profiles
  alter column username set not null,
  add constraint profiles_username_unique unique (username);

-- 4. Index for fast username lookups
create index if not exists idx_profiles_username
  on public.profiles (username);

-- 5. RPC to resolve username → email (for login)
create or replace function public.resolve_username(username_input text)
returns table (email text)
language sql
security definer
stable
as $$
  select p.email
  from public.profiles p
  where p.username = username_input
    and p.is_active = true;
$$;

-- 6. Update handle_new_user trigger to auto-populate username
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name, email, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'walas')
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    username = excluded.username,
    role = excluded.role;
  return new;
end;
$$;

commit;
