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

// Jangan auto-redirect memakai sesi lama.
// Ini penting jika browser masih menyimpan sesi akun visitor/moderator sebelumnya.
// Kita bersihkan sesi project yang dipilih terlebih dahulu supaya login berikutnya
// benar-benar menggunakan email/password yang baru dimasukkan.
client.auth.getSession().then(async ({ data }) => {
  if (data.session) {
    console.log('SECRET ROOM: membersihkan sesi lama:', data.session.user.email);
    await client.auth.signOut();
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

  const { error } = await client.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.textContent = 'Masuk';

  if (error) {
    errorEl.textContent = 'Email atau password salah.';
    return;
  }

  window.location.href = dest;
});
