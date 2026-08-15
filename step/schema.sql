-- ============================================================
-- SKEMA DATABASE — Galeri Kelas XII Satelit
-- Jalankan seluruh file ini di Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Tabel PROFILES
--    Menyimpan peran (role) tiap user: admin atau visitor.
--    Terhubung 1:1 dengan auth.users bawaan Supabase.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'visitor' check (role in ('admin', 'visitor')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Semua user login bisa lihat semua profile"
on public.profiles for select
to authenticated
using (true);

create policy "User hanya bisa update profile miliknya sendiri"
on public.profiles for update
to authenticated
using (auth.uid() = id);

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


-- 2. Tabel PHOTOS
--    Menyimpan metadata tiap foto. File asli foto disimpan
--    di Supabase Storage (bucket 'class-photos'); kolom
--    image_url berisi URL publiknya, storage_path dipakai
--    untuk menghapus file dari storage saat foto dihapus.
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  storage_path text not null default '',
  caption text,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.photos enable row level security;

create policy "Semua user login bisa lihat foto"
on public.photos for select
to authenticated
using (true);

create policy "Hanya admin yang bisa upload foto (insert)"
on public.photos for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

create policy "Hanya admin yang bisa hapus foto"
on public.photos for delete
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);


-- 3. STORAGE BUCKET untuk file foto
insert into storage.buckets (id, name, public)
values ('class-photos', 'class-photos', true)
on conflict (id) do nothing;

create policy "Publik bisa lihat / download foto"
on storage.objects for select
using (bucket_id = 'class-photos');

create policy "Hanya admin yang bisa upload file ke storage"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'class-photos'
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

create policy "Hanya admin yang bisa hapus file di storage"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'class-photos'
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);


-- ============================================================
-- 4. MENJADIKAN SATU AKUN SEBAGAI ADMIN
--    Jalankan ini SETELAH kamu membuat user admin lewat
--    Dashboard > Authentication > Users (lihat README.md).
--    Ganti email di bawah sesuai email admin yang kamu buat.
-- ============================================================
-- update public.profiles
-- set role = 'admin'
-- where id = (select id from auth.users where email = 'admin@kelasxiisatelit.com');
