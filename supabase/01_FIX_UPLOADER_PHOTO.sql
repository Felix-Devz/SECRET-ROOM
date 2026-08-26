-- SECRET ROOM - FIX ROLE UPLOADER (PROJECT FOTO)
-- Jalankan UTUH di SQL Editor PROJECT FOTO.
-- MODERATOR/UPLOADER: upload foto saja, TIDAK bisa hapus.
-- ADMIN: upload + hapus.
-- VISITOR: lihat saja.

begin;

-- Pastikan role uploader valid.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'uploader', 'visitor'));

-- User tidak boleh mengubah role sendiri.
drop policy if exists "User hanya bisa update profile miliknya sendiri" on public.profiles;
drop policy if exists "User hanya bisa update nama sendiri" on public.profiles;
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;
create policy "User hanya bisa update nama sendiri"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- FOTO: upload admin + uploader.
drop policy if exists "Hanya admin yang bisa upload foto (insert)" on public.photos;
drop policy if exists "Admin & uploader bisa upload foto (insert)" on public.photos;
create policy "Admin & uploader bisa upload foto (insert)"
on public.photos for insert
to authenticated
with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','uploader'))
);

-- FOTO: hapus admin saja.
drop policy if exists "Hanya admin yang bisa hapus foto" on public.photos;
create policy "Hanya admin yang bisa hapus foto"
on public.photos for delete
to authenticated
using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- STORAGE FOTO: upload admin + uploader.
drop policy if exists "Hanya admin yang bisa upload file ke storage" on storage.objects;
drop policy if exists "Admin & uploader bisa upload file ke storage" on storage.objects;
create policy "Admin & uploader bisa upload file ke storage"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'class-photos'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','uploader'))
);

-- STORAGE FOTO: hapus admin saja.
drop policy if exists "Hanya admin yang bisa hapus file di storage" on storage.objects;
drop policy if exists "Hanya admin yang bisa hapus file ke storage" on storage.objects;
drop policy if exists "Hanya admin yang bisa hapus file dari storage" on storage.objects;
create policy "Hanya admin yang bisa hapus file di storage"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'class-photos'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- AKUN MODERATOR PADA SCREENSHOT
-- Jadikan mods@gmail.com uploader pada project FOTO.
update public.profiles p
set role = 'uploader'
from auth.users u
where p.id = u.id and lower(u.email) = 'mods@gmail.com';

commit;

-- VERIFIKASI:
select u.email, p.role
from auth.users u
join public.profiles p on p.id = u.id
where lower(u.email) = 'mods@gmail.com';
