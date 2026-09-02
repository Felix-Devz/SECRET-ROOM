-- ============================================================
-- SETUP DARI NOL — PROJECT VIDEO
-- Jalankan SEMUA isi file ini sekaligus di:
-- Supabase Dashboard (project VIDEO yang baru) > SQL Editor > Run
-- ============================================================

-- 0. GRANT DASAR (wajib, tanpa ini muncul error 403 "permission denied")
grant usage on schema public to authenticated;

-- 1. Tabel PROFILES (peran: admin / uploader / visitor)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'visitor' check (role in ('admin', 'uploader', 'visitor')),
  created_at timestamptz not null default now()
);

grant select on public.profiles to authenticated;
-- User cuma boleh update nama sendiri, TIDAK boleh ubah role diri sendiri
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

-- Trigger: setiap user baru daftar -> otomatis dapat role 'visitor'
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

create policy "Admin & uploader bisa upload video (insert)"
on public.videos for insert
to authenticated
with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'uploader'))
);

create policy "Hanya admin yang bisa hapus video"
on public.videos for delete
to authenticated
using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
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

create policy "Admin & uploader bisa upload file ke storage"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'class-videos'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'uploader'))
);

create policy "Hanya admin yang bisa hapus file di storage"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'class-videos'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);


-- ============================================================
-- 4. SET ROLE UNTUK MASING-MASING AKUN
--    Jalankan SETELAH kamu bikin 3 akun ini lewat
--    Dashboard > Authentication > Users > Add user
--    (centang "Auto Confirm User" tiap bikin akun)
--    Ganti email di bawah sesuai email yang kamu buat.
-- ============================================================

-- Akun ADMIN (upload + hapus)
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'admin@gmail.com');

-- Akun MODS / uploader (upload saja, TIDAK bisa hapus)
update public.profiles
set role = 'uploader'
where id = (select id from auth.users where email = 'mods@gmail.com');

-- Akun TAMU dibiarkan default 'visitor' (cuma bisa lihat) -> tidak perlu di-update
