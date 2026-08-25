-- ============================================================
-- MIGRASI: Tambah fitur MOMEN VIDEO
-- Jalankan file ini di Supabase Dashboard > SQL Editor kalau
-- project Supabase-mu SUDAH ada (sudah punya tabel photos dll),
-- jadi tidak perlu jalankan ulang schema.sql dari awal.
-- ============================================================

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  video_url text not null,
  storage_path text not null default '',
  caption text,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

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
    where id = auth.uid() and role = 'admin'
  )
);

create policy "Hanya admin yang bisa hapus video"
on public.videos for delete
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

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
    where id = auth.uid() and role = 'admin'
  )
);

create policy "Hanya admin yang bisa hapus file video di storage"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'class-videos'
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);
