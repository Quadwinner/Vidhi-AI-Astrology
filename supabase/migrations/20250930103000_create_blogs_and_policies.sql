-- Create blogs table if it doesn't exist
create table if not exists public.blogs (
  id bigserial primary key,
  title text not null,
  content text not null,
  excerpt text default '' not null,
  slug text unique not null,
  featured_image_url text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  author_id uuid references auth.users(id) on delete set null
);

alter table public.blogs enable row level security;

-- Policy: anyone can read published blogs
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'blogs' and policyname = 'Allow read published'
  ) then
    create policy "Allow read published" on public.blogs
      for select
      using (published = true);
  end if;
end $$;

-- Policy: admins can do everything
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'blogs' and policyname = 'Admins full access'
  ) then
    create policy "Admins full access" on public.blogs
      for all
      using (exists (select 1 from public.users u where u.id = auth.uid() and coalesce(u.is_admin, false) = true))
      with check (exists (select 1 from public.users u where u.id = auth.uid() and coalesce(u.is_admin, false) = true));
  end if;
end $$;


