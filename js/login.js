import { supabase } from './supabaseClient.js';
import { supabaseVideo } from './supabaseClientVideo.js';

const form = document.getElementById('loginForm');
const errorEl = document.getElementById('loginError');
const loginSub = document.getElementById('loginSub');

// Ambil pilihan (foto/video) dari hash URL (#tipe=video), BUKAN dari
// query string (?tipe=video) — karena server 'serve' suka redirect
// login.html -> login dan membuang query string-nya. Hash (#...) aman
// karena tidak pernah dikirim ke server, jadi tidak ikut kebuang.
const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
let tipe = hashParams.get('tipe');
if (tipe === 'foto' || tipe === 'video') {
  sessionStorage.setItem('secretRoomTipe', tipe);
} else {
  tipe = sessionStorage.getItem('secretRoomTipe') || 'foto';
}

// Foto dan video sekarang ada di project Supabase yang BERBEDA,
// jadi pilih client sesuai tipe yang dipilih user.
const client = tipe === 'video' ? supabaseVideo : supabase;
const dest = tipe === 'video' ? 'video-gallery.html' : 'gallery.html';
if (loginSub) {
  loginSub.textContent = tipe === 'video'
    ? 'Masuk untuk melihat momen video kelas XII Satelit'
    : 'Masuk untuk melihat momen foto kelas XII Satelit';
}

// Jangan otomatis memakai sesi lama. User harus login dengan akun yang dipilih.
// Ini mencegah akun visitor lama terbawa saat mencoba login sebagai moderator/uploader.
client.auth.getSession().then(({ data }) => {
  if (data.session) {
    console.log('SECRET ROOM: sesi lama ditemukan, akan dibersihkan sebelum login baru:', data.session.user.email);
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = form.querySelector('button[type="submit"]');

  btn.disabled = true;
  btn.textContent = 'Memproses...';

  // Hapus sesi lama dari project yang dipakai agar akun yang baru dimasukkan benar-benar aktif.
  await client.auth.signOut();

  const { data: loginData, error } = await client.auth.signInWithPassword({ email, password });
  console.log('SECRET ROOM login:', {
    email,
    tipe,
    user_id: loginData?.user?.id || null,
    error
  });

  btn.disabled = false;
  btn.textContent = 'Masuk';

  if (error) {
    errorEl.textContent = 'Email atau password salah.';
    return;
  }

  window.location.href = dest;
});
