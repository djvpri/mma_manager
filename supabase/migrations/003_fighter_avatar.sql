-- Add column to store AI-generated portrait URL
alter table fighters add column if not exists avatar_url text;

-- Storage bucket for fighter portraits (public read)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly accessible"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "Users can upload avatars for their own gym"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and auth.uid() = (select user_id from gyms where id::text = (storage.foldername(name))[1])
);

create policy "Users can update avatars for their own gym"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and auth.uid() = (select user_id from gyms where id::text = (storage.foldername(name))[1])
);
