-- ============================================================
-- TAMBAH ROLE "uploader" — bisa upload, TIDAK BISA hapus
-- Jalankan file ini di SQL Editor project FOTO, lalu jalankan
-- LAGI (dengan menyesuaikan nama tabel photos -> videos) di
-- project VIDEO. Dua versi sudah disiapkan di bawah, pilih
-- salah satu sesuai project yang lagi kamu buka.
-- ============================================================


-- ========== VERSI UNTUK PROJECT FOTO (tabel: photos) ==========

-- 1. Izinkan nilai role baru 'uploader' di tabel profiles
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'uploader', 'visitor'));

-- 2. Izinkan uploader (selain admin) untuk INSERT foto
drop policy if exists "Hanya admin yang bisa upload foto (insert)" on public.photos;
create policy "Admin & uploader bisa upload foto (insert)"
on public.photos for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'uploader')
  )
);

-- 3. HAPUS foto tetap KHUSUS admin saja (policy delete tidak diubah,
--    cukup pastikan masih ada — dibiarkan seperti semula)

-- 4. Izinkan uploader upload file ke Storage juga
drop policy if exists "Hanya admin yang bisa upload file ke storage" on storage.objects;
create policy "Admin & uploader bisa upload file ke storage"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'class-photos'
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'uploader')
  )
);


-- ========== VERSI UNTUK PROJECT VIDEO (tabel: videos) ==========
-- (Hapus tanda komentar -- di bawah ini kalau mau jalankan versi video,
--  lalu jalankan di SQL Editor project VIDEO)

-- alter table public.profiles drop constraint if exists profiles_role_check;
-- alter table public.profiles add constraint profiles_role_check
--   check (role in ('admin', 'uploader', 'visitor'));

-- drop policy if exists "Hanya admin yang bisa upload video (insert)" on public.videos;
-- create policy "Admin & uploader bisa upload video (insert)"
-- on public.videos for insert
-- to authenticated
-- with check (
--   exists (
--     select 1 from public.profiles
--     where id = auth.uid() and role in ('admin', 'uploader')
--   )
-- );

-- drop policy if exists "Hanya admin yang bisa upload file video ke storage" on storage.objects;
-- create policy "Admin & uploader bisa upload file video ke storage"
-- on storage.objects for insert
-- to authenticated
-- with check (
--   bucket_id = 'class-videos'
--   and exists (
--     select 1 from public.profiles
--     where id = auth.uid() and role in ('admin', 'uploader')
--   )
-- );


-- ============================================================
-- CARA MENJADIKAN SESEORANG "uploader":
-- Ganti email di bawah, jalankan di project yang sesuai (foto/video)
-- ============================================================
-- update public.profiles
-- set role = 'uploader'
-- where id = (select id from auth.users where email = 'EMAIL_UPLOADER@contoh.com');
