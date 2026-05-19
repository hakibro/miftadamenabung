insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'app-assets',
  'app-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "app assets public read" on storage.objects;
create policy "app assets public read" on storage.objects for select using (
  bucket_id = 'app-assets'
);

drop policy if exists "app assets admin insert" on storage.objects;
create policy "app assets admin insert" on storage.objects for insert with check (
  bucket_id = 'app-assets' and public.is_admin()
);

drop policy if exists "app assets admin update" on storage.objects;
create policy "app assets admin update" on storage.objects for update using (
  bucket_id = 'app-assets' and public.is_admin()
) with check (
  bucket_id = 'app-assets' and public.is_admin()
);

drop policy if exists "app assets admin delete" on storage.objects;
create policy "app assets admin delete" on storage.objects for delete using (
  bucket_id = 'app-assets' and public.is_admin()
);
