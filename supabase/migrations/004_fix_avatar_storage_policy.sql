-- Simplify avatar storage policies: store files under {user_id}/{fighter_id}.png
-- and authorize purely on auth.uid(), avoiding a cross-table subquery.

drop policy if exists "Users can upload avatars for their own gym" on storage.objects;
drop policy if exists "Users can update avatars for their own gym" on storage.objects;

create policy "Users can upload their own avatars"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can update their own avatars"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);
