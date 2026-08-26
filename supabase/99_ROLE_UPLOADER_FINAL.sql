-- SECRET ROOM - FINAL ROLE FIX
-- Jalankan di PROJECT FOTO dan PROJECT VIDEO masing-masing.
-- Aman dijalankan ulang.

-- 1. Pastikan role uploader diperbolehkan.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'uploader', 'visitor'));

-- 2. Profile boleh dibaca user login, tetapi TIDAK boleh mengubah role sendiri.
grant select on public.profiles to authenticated;
drop policy if exists "Semua user login bisa lihat semua profile" on public.profiles;
create policy "Authenticated users can read profiles"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "User hanya bisa update profile miliknya sendiri" on public.profiles;
-- Sengaja tidak membuat policy UPDATE profiles untuk user biasa.
-- Perubahan role dilakukan dari Supabase SQL/Admin saja.

-- 3. FOTO: uploader + admin boleh INSERT, hanya admin DELETE.
do $$
begin
  if to_regclass('public.photos') is not null then
    execute 'drop policy if exists "Hanya admin yang bisa upload foto (insert)" on public.photos';
    execute 'drop policy if exists "Admin & uploader bisa upload foto (insert)" on public.photos';
    execute $$create policy "Admin & uploader can upload photos" on public.photos
      for insert to authenticated
      with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','uploader')))$$;
  end if;
end $$;

-- 4. VIDEO: uploader + admin boleh INSERT, hanya admin DELETE.
do $$
begin
  if to_regclass('public.videos') is not null then
    execute 'drop policy if exists "Hanya admin yang bisa upload video (insert)" on public.videos';
    execute 'drop policy if exists "Admin & uploader bisa upload video (insert)" on public.videos';
    execute $$create policy "Admin & uploader can upload videos" on public.videos
      for insert to authenticated
      with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','uploader')))$$;
  end if;
end $$;

-- 5. Storage: uploader + admin boleh upload, hanya admin boleh delete.
drop policy if exists "Hanya admin yang bisa upload file ke storage" on storage.objects;
drop policy if exists "Admin & uploader bisa upload file ke storage" on storage.objects;
drop policy if exists "Admin & uploader bisa upload file video ke storage" on storage.objects;
drop policy if exists "Admin & uploader can upload files" on storage.objects;

create policy "Admin & uploader can upload files"
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('class-photos', 'class-videos')
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','uploader'))
);

-- Jangan membuat DELETE untuk uploader. Policy DELETE lama yang hanya admin tetap dipakai.

-- 6. Set akun moderator di project ini.
-- Ganti email jika diperlukan.
update public.profiles
set role = 'uploader'
where id = (select id from auth.users where lower(email) = lower('mods@gmail.com'));

-- 7. Verifikasi.
select u.email, u.id as auth_user_id, p.id as profile_id, p.role
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('mods@gmail.com');
