-- ============================================================
-- SKEMA DATABASE — Galeri Kelas XII Satelit (PROJECT VIDEO)
-- Jalankan seluruh file ini di Supabase Dashboard PROJECT VIDEO
-- (project Supabase yang BERBEDA dari project foto) > SQL Editor
-- ============================================================

-- ============================================================
-- 0. GRANT DASAR (WAJIB) — role 'authenticated' butuh izin dasar
--    di level tabel, terpisah dari RLS policy. Tanpa ini,
--    walaupun RLS policy sudah benar, tetap akan muncul error
--    403 "permission denied for table ..." (kode 42501).
-- ============================================================
grant usage on schema public to authenticated;

-- 1. Tabel PROFILES
--    Project video punya user & auth sendiri (terpisah dari
--    project foto), jadi tabel profiles ini juga perlu dibuat
--    ulang di sini.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'visitor' check (role in ('admin', 'uploader', 'visitor')),
  created_at timestamptz not null default now()
);

grant select on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

alter table public.profiles enable row level security;

create policy "Semua user login bisa lihat semua profile"
on public.profiles for select
to authenticated
using (true);

create policy "User hanya bisa update nama sendiri"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Trigger: setiap kali ada user baru di auth.users,
-- otomatis buatkan baris profiles dengan role default 'visitor'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', 'visitor')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();


-- 2. Tabel VIDEOS
--    Menyimpan metadata tiap video. File asli video disimpan
--    di Supabase Storage (bucket 'class-videos'); kolom
--    video_url berisi URL publiknya, storage_path dipakai
--    untuk menghapus file dari storage saat video dihapus.
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  video_url text not null,
  storage_path text not null default '',
  caption text,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

grant select, insert, delete on public.videos to authenticated;

alter table public.videos enable row level security;

create policy "Semua user login bisa lihat video"
on public.videos for select
to authenticated
using (true);

create policy "Hanya admin yang bisa upload video (insert)"
on public.videos for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'uploader')
  )
);

create policy "Hanya admin yang bisa hapus video"
on public.videos for delete
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'uploader')
  )
);


-- 3. STORAGE BUCKET untuk file video
grant select, insert, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;

insert into storage.buckets (id, name, public)
values ('class-videos', 'class-videos', true)
on conflict (id) do nothing;

create policy "Publik bisa lihat / download video"
on storage.objects for select
using (bucket_id = 'class-videos');

create policy "Hanya admin yang bisa upload file video ke storage"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'class-videos'
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'uploader')
  )
);

create policy "Hanya admin yang bisa hapus file video di storage"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'class-videos'
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'uploader')
  )
);


-- ============================================================
-- 4. MENJADIKAN SATU AKUN SEBAGAI ADMIN (DI PROJECT VIDEO INI)
--    Jalankan ini SETELAH kamu membuat user admin lewat
--    Dashboard PROJECT VIDEO > Authentication > Users.
--    Ganti email di bawah sesuai email admin yang kamu buat
--    (boleh sama persis dengan email admin di project foto,
--    karena ini project & auth yang beda, tidak akan bentrok).
-- ============================================================
-- update public.profiles
-- set role = 'admin'
-- where id = (select id from auth.users where email = 'admin@kelasxiisatelit.com');
