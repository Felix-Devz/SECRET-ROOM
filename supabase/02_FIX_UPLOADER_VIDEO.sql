-- SECRET ROOM - FIX ROLE UPLOADER (PROJECT VIDEO)
-- Jalankan UTUH di SQL Editor PROJECT VIDEO.
-- MODERATOR/UPLOADER: upload video saja, TIDAK bisa hapus.
-- ADMIN: upload + hapus.
-- VISITOR: lihat saja.

begin;

grant usage on schema public to authenticated;

grant select, insert, delete on public.videos to authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'uploader', 'visitor'));

drop policy if exists "User hanya bisa update profile miliknya sendiri" on public.profiles;
drop policy if exists "User hanya bisa update nama sendiri" on public.profiles;
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;
create policy "User hanya bisa update nama sendiri"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- VIDEO: upload admin + uploader.
drop policy if exists "Hanya admin yang bisa upload video (insert)" on public.videos;
drop policy if exists "Admin & uploader bisa upload video (insert)" on public.videos;
create policy "Admin & uploader bisa upload video (insert)"
on public.videos for insert
to authenticated
with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','uploader'))
);

-- VIDEO: hapus admin saja.
drop policy if exists "Hanya admin yang bisa hapus video" on public.videos;
create policy "Hanya admin yang bisa hapus video"
on public.videos for delete
to authenticated
using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- STORAGE VIDEO: upload admin + uploader.
drop policy if exists "Hanya admin yang bisa upload file video ke storage" on storage.objects;
drop policy if exists "Admin & uploader bisa upload file video ke storage" on storage.objects;
create policy "Admin & uploader bisa upload file video ke storage"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'class-videos'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','uploader'))
);

-- STORAGE VIDEO: hapus admin saja.
drop policy if exists "Hanya admin yang bisa hapus file video" on storage.objects;
drop policy if exists "Hanya admin yang bisa hapus file ke storage" on storage.objects;
create policy "Hanya admin yang bisa hapus file video"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'class-videos'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- AKUN MODERATOR PADA SCREENSHOT
-- Jadikan mods@gmail.com uploader pada project VIDEO.
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
