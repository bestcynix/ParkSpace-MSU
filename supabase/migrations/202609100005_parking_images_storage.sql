begin;

-- Parking area images (cover and entrance photos) are public presentation assets.
insert into storage.buckets (id, name, public)
values ('parking-images', 'parking-images', true)
on conflict (id) do update set public = true;

drop policy if exists "public read parking images" on storage.objects;
create policy "public read parking images" on storage.objects
  for select to public
  using (bucket_id = 'parking-images');

drop policy if exists "admin manage parking images" on storage.objects;
create policy "admin manage parking images" on storage.objects
  for all to authenticated
  using (bucket_id = 'parking-images' and (public.has_role('admin') or public.has_role('developer')))
  with check (bucket_id = 'parking-images' and (public.has_role('admin') or public.has_role('developer')));

commit;
