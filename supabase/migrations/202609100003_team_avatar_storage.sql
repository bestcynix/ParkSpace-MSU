begin;

-- Project team avatars are public presentation assets. Personal profile
-- avatars remain in the separate private profile-avatars bucket.
insert into storage.buckets (id, name, public)
values ('team-avatars', 'team-avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "public read team avatars" on storage.objects;
create policy "public read team avatars" on storage.objects
  for select to public
  using (bucket_id = 'team-avatars');

drop policy if exists "admin manage team avatars" on storage.objects;
create policy "admin manage team avatars" on storage.objects
  for all to authenticated
  using (bucket_id = 'team-avatars' and public.has_role('admin'))
  with check (bucket_id = 'team-avatars' and public.has_role('admin'));

drop policy if exists "developer manage team avatars" on storage.objects;
create policy "developer manage team avatars" on storage.objects
  for all to authenticated
  using (bucket_id = 'team-avatars' and public.has_role('developer'))
  with check (bucket_id = 'team-avatars' and public.has_role('developer'));

commit;
