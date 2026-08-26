-- ============================================================
-- MIGRASI ROLE UPLOADER — PROJECT VIDEO
-- Jalankan di SQL Editor PROJECT VIDEO.
-- uploader: boleh upload video, TIDAK boleh hapus.
-- admin: boleh upload + hapus.
-- visitor: hanya melihat.
-- ============================================================

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'uploader', 'visitor'));

-- Cegah user biasa mengubah role dirinya sendiri dari browser.
drop policy if exists "User hanya bisa update profile miliknya sendiri" on public.profiles;
drop policy if exists "User hanya bisa update nama sendiri" on public.profiles;
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;
create policy "User hanya bisa update nama sendiri"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Upload video: admin + uploader.
drop policy if exists "Hanya admin yang bisa upload video (insert)" on public.videos;
drop policy if exists "Admin & uploader bisa upload video (insert)" on public.videos;
create policy "Admin & uploader bisa upload video (insert)"
on public.videos for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'uploader')
  )
);

-- Hapus video: ADMIN SAJA.
drop policy if exists "Hanya admin yang bisa hapus video" on public.videos;
create policy "Hanya admin yang bisa hapus video"
on public.videos for delete
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

-- Storage upload: admin + uploader.
drop policy if exists "Hanya admin yang bisa upload file video ke storage" on storage.objects;
drop policy if exists "Admin & uploader bisa upload file video ke storage" on storage.objects;
create policy "Admin & uploader bisa upload file video ke storage"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'class-videos'
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'uploader')
  )
);

-- Storage delete: ADMIN SAJA.
drop policy if exists "Hanya admin yang bisa hapus file video" on storage.objects;
create policy "Hanya admin yang bisa hapus file video"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'class-videos'
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

-- Jadikan akun sebagai uploader (jalankan setelah user dibuat):
-- update public.profiles
-- set role = 'uploader'
-- where id = (select id from auth.users where email = 'EMAIL_UPLOADER');
