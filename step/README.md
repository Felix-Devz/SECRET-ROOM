# Galeri Kelas XII Satelit — versi online (Supabase)

Website galeri foto dengan database sungguhan, login, upload foto oleh admin,
dan tampilan real-time. Tidak perlu proses build/instalasi apa pun — murni
HTML/CSS/JS dan bisa langsung dideploy sebagai situs statis.

## Struktur project

```
galeri-kelas-online/
├── index.html          # Halaman login
├── gallery.html         # Halaman galeri (perlu login)
├── css/
│   └── style.css
├── js/
│   ├── supabaseConfig.js   # ISI dengan URL & anon key project Supabase-mu
│   ├── supabaseClient.js
│   ├── login.js
│   └── gallery.js
├── supabase/
│   └── schema.sql       # Jalankan sekali di SQL Editor Supabase
└── README.md
```

## Langkah setup (± 10 menit)

### 1. Buat project Supabase

Daftar gratis di https://supabase.com → **New Project**. Catat password
database yang kamu buat (tidak dipakai di sini, tapi simpan saja).

### 2. Jalankan skema database

Buka **SQL Editor** di dashboard Supabase → tempel seluruh isi
`supabase/schema.sql` → klik **Run**.

Ini akan membuat:

- Tabel `profiles` (peran admin/pengunjung, otomatis terisi saat user baru daftar)
- Tabel `photos` (metadata tiap foto)
- Row Level Security: hanya admin yang boleh upload/hapus, semua user login boleh lihat
- Bucket storage `class-photos` untuk file foto asli

### 3. Buat 2 akun (admin & pengunjung)

Buka **Authentication → Users → Add user** di dashboard, buat dua akun,
centang **Auto Confirm User** supaya tidak perlu verifikasi email:

| Akun       | Email contoh                   | Password              |
| ---------- | ------------------------------ | --------------------- |
| Admin      | admin@kelasxiisatelit.com      | bebas, min 6 karakter |
| Pengunjung | pengunjung@kelasxiisatelit.com | bebas, min 6 karakter |

> Supabase Auth login pakai **email**, bukan username bebas — email di atas
> tidak perlu benar-benar aktif, cukup format email yang valid.

### 4. Jadikan satu akun sebagai admin

Secara default semua akun baru otomatis berperan `visitor`. Di **SQL Editor**,
jalankan (ganti email sesuai akun admin yang kamu buat):

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'admin@gmail,com');
```

### 5. Ambil kredensial API

Buka **Project Settings → API**, salin:

- **Project URL**
- **anon public key**

Tempel ke `js/supabaseConfig.js`:

```js
export const SUPABASE_URL = "https://xxxxxxxxxxxxxxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJ...";
```

### 6. Coba jalankan secara lokal

Karena file JS pakai `type="module"`, kamu **tidak bisa** buka `index.html`
langsung dengan double-click (akan diblokir CORS oleh browser). Jalankan lewat
server lokal sederhana, misalnya salah satu dari:

```bash
# opsi 1: pakai Python (biasanya sudah terpasang)
python3 -m http.server 5500

# opsi 2: pakai Node
npx serve .
```

Lalu buka `http://localhost:5500` di browser.

### 7. Deploy online (gratis)

Paling gampang pakai **Netlify** atau **Vercel**:

- Netlify: buka https://app.netlify.com/drop, drag-drop folder `galeri-kelas-online`
- Vercel: `npx vercel` dari dalam folder project, ikuti instruksinya
- Atau GitHub Pages: push folder ini ke repo GitHub, aktifkan Pages dari branch tsb

Tidak perlu setting apa pun di sisi Netlify/Vercel — semua koneksi database
langsung dari browser ke Supabase pakai `anon key` (aman, karena dibatasi RLS
yang sudah kita atur: hanya admin yang bisa upload/hapus).

## Cara pakai

1. Buka situs → login pakai salah satu dari 2 akun di atas
2. Kalau login sebagai **admin**: muncul tombol "+ Tambah Foto", bisa upload
   foto + keterangan, dan bisa hapus foto lewat tombol ✕
3. Kalau login sebagai **pengunjung**: hanya bisa melihat foto
4. Foto otomatis muncul real-time ke semua orang yang sedang membuka galeri
   begitu admin selesai upload (tanpa perlu refresh)

## Menambah lebih banyak akun pengunjung

Ulangi langkah 3 (buat user baru di Authentication → Users). Karena default
role-nya `visitor`, tidak perlu langkah tambahan — mereka otomatis bisa login
dan melihat galeri.

## Catatan keamanan

- Jangan taruh **service_role key** di file manapun di folder ini — yang
  dipakai hanya **anon key**, dan itu memang didesain aman untuk kode
  client-side selama RLS aktif (sudah diatur di `schema.sql`).
- Batas ukuran upload foto diset 8MB di `js/gallery.js` (`MAX_FILE_MB`) —
  ubah sesuai kebutuhan.
