import { supabase } from './supabaseClient.js';

const form = document.getElementById('loginForm');
const errorEl = document.getElementById('loginError');

// Kalau sudah login sebelumnya, langsung lempar ke galeri
supabase.auth.getSession().then(({ data }) => {
  if (data.session) window.location.href = 'gallery.html';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = form.querySelector('button[type="submit"]');

  btn.disabled = true;
  btn.textContent = 'Memproses...';

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.textContent = 'Masuk';

  if (error) {
    errorEl.textContent = 'Email atau password salah.';
    return;
  }

  window.location.href = 'gallery.html';
});
