// Admin password API v3: use Vercel /api/admin-password, not Supabase Edge Functions.
import { supabase } from './supabaseClient.js';

const BUCKET = 'class-photos';
const MAX_FILE_MB = 8;

let session = null;
let profile = { role: 'visitor' };

const grid = document.getElementById('grid');
const roleBadge = document.getElementById('roleBadge');
const logoutBtn = document.getElementById('logoutBtn');
const changePasswordBtn = document.getElementById('changePasswordBtn');
const fileInput = document.getElementById('fileInput');
const modalOverlay = document.getElementById('modalOverlay');
const modalBody = document.getElementById('modalBody');
const lightboxOverlay = document.getElementById('lightboxOverlay');
const lightboxContent = document.getElementById('lightboxContent');
const lightboxClose = document.getElementById('lightboxClose');

function openLightbox(url, caption) {
  lightboxContent.innerHTML = `<img src="${url}" alt="${escapeHtml(caption || 'Foto kelas')}"/>`;
  lightboxOverlay.style.display = 'flex';
}
function closeLightbox() {
  lightboxOverlay.style.display = 'none';
  lightboxContent.innerHTML = '';
}
lightboxClose.addEventListener('click', closeLightbox);
lightboxOverlay.addEventListener('click', (e) => {
  if (e.target.id === 'lightboxOverlay') closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});

init();

async function init() {
  const { data: { session: s } } = await supabase.auth.getSession();
  if (!s) {
    window.location.href = 'login.html#tipe=foto';
    return;
  }
  session = s;

  const { data: prof, error } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', session.user.id)
    .single();

  if (error) console.error('Gagal ambil profile:', error);
  profile = prof || { role: 'visitor' };

  roleBadge.textContent = profile.role === 'admin' ? '👑 Admin' : (profile.role === 'uploader' ? '🛡️ Moderator' : '🙋 Pengunjung');
  changePasswordBtn.style.display = profile.role === 'admin' ? 'inline-flex' : 'none';

  await loadPhotos();
  subscribeRealtime();
}

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
});

// (dipertahankan) tombol logout mengarah balik ke halaman pilihan momen

changePasswordBtn.addEventListener('click', openAdminPasswordModal);

function openAdminPasswordModal() {
  if (profile.role !== 'admin') return;

  modalBody.innerHTML = `
    <h3>Kelola Password</h3>
    <label>Akun</label>
    <select id="targetUser" style="width:100%;margin-bottom:12px">
      <option value="">Memuat akun...</option>
    </select>
    <label>Password Baru</label>
    <input id="newPassword" type="password" placeholder="Minimal 6 karakter" autocomplete="new-password"/>
    <label style="margin-top:12px">Ulangi Password Baru</label>
    <input id="confirmPassword" type="password" placeholder="Ketik ulang password baru" autocomplete="new-password"/>
    <p id="passwordError" class="error" style="text-align:left"></p>
    <div class="modal-actions">
      <button id="cancelBtn" class="btn-secondary">Batal</button>
      <button id="savePasswordBtn" class="btn-primary">Simpan</button>
    </div>
  `;
  modalOverlay.style.display = 'flex';
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('savePasswordBtn').addEventListener('click', submitAdminPasswordReset);
  loadAdminUsers();
}

async function adminPasswordFunction(payload) {
  if (!session?.access_token) throw new Error('Sesi login sudah habis. Silakan login kembali.');

  const response = await fetch('/api/admin-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'X-Admin-Project': 'photo',
    },
    body: JSON.stringify(payload),
  });

  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data?.error || `Server error (${response.status})`);
  if (data?.error) throw new Error(data.error);
  return data;
}

async function loadAdminUsers() {
  const select = document.getElementById('targetUser');
  const errorEl = document.getElementById('passwordError');
  try {
    const data = await adminPasswordFunction({ action: 'list-users' });
    select.innerHTML = '';
    (data.users || []).forEach((user) => {
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = `${user.full_name ? user.full_name + ' — ' : ''}${user.email} (${user.role})`;
      select.appendChild(option);
    });
    if (!data.users?.length) errorEl.textContent = 'Tidak ada akun yang tersedia.';
  } catch (error) {
    console.error(error);
    errorEl.textContent = 'Gagal memuat daftar akun: ' + error.message;
  }
}

async function submitAdminPasswordReset() {
  const targetUser = document.getElementById('targetUser').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const errorEl = document.getElementById('passwordError');
  const saveBtn = document.getElementById('savePasswordBtn');
  errorEl.textContent = '';

  if (!targetUser) {
    errorEl.textContent = 'Pilih akun terlebih dahulu.';
    return;
  }
  if (newPassword.length < 6) {
    errorEl.textContent = 'Password minimal 6 karakter.';
    return;
  }
  if (newPassword !== confirmPassword) {
    errorEl.textContent = 'Password tidak cocok, coba lagi.';
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Menyimpan...';

  try {
    await adminPasswordFunction({
      action: 'reset-password',
      user_id: targetUser,
      password: newPassword,
    });
    closeModal();
    alert('Password akun berhasil diubah.');
  } catch (error) {
    console.error(error);
    errorEl.textContent = 'Gagal mengubah password: ' + error.message;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Simpan';
  }
}

async function loadPhotos() {
  const { data, error } = await supabase
    .from('photos')
    .select('id, image_url, caption, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    grid.innerHTML = '<div class="empty-state">Gagal memuat foto. Coba muat ulang halaman.</div>';
    return;
  }
  renderGrid(data || []);
}

function renderGrid(photos) {
  grid.innerHTML = '';

  const canUpload = profile.role === 'admin' || profile.role === 'uploader';
  const canDelete = profile.role === 'admin';

  if (canUpload) {
    const tile = document.createElement('div');
    tile.className = 'upload-tile';
    tile.innerHTML = '<span class="plus">+</span><span>Tambah Foto</span>';
    tile.addEventListener('click', () => fileInput.click());
    grid.appendChild(tile);
  }

  if (photos.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = canUpload
      ? 'Belum ada foto. Klik "+ Tambah Foto" untuk mengunggah momen pertama!'
      : 'Belum ada foto. Nantikan admin mengunggah momen pertama!';
    grid.appendChild(empty);
    return;
  }

  photos.forEach((photo) => {
    const card = document.createElement('div');
    card.className = 'polaroid';
    card.style.setProperty('--r', (Math.random() * 6 - 3) + 'deg');
    card.innerHTML = `
      <div class="photo-frame"><img src="${photo.image_url}" alt="${escapeHtml(photo.caption || 'Foto kelas')}" loading="lazy"/></div>
      <div class="caption">${photo.caption ? escapeHtml(photo.caption) : '&nbsp;'}</div>
      ${canDelete ? '<button class="del-btn" title="Hapus">✕</button>' : ''}
    `;
    card.querySelector('.photo-frame').addEventListener('click', () => openLightbox(photo.image_url, photo.caption));
    if (canDelete) {
      card.querySelector('.del-btn').addEventListener('click', () => confirmDelete(photo.id));
    }
    grid.appendChild(card);
  });
}

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;

  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    showSizeWarning(file, 'foto');
    return;
  }
  openCaptionModal(file);
});

function showSizeWarning(file, jenis) {
  const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
  modalBody.innerHTML = `
    <h3>⚠️ Ukuran ${jenis} terlalu besar</h3>
    <p class="modal-text">
      File yang kamu pilih berukuran <strong>${sizeMb}MB</strong>, melebihi batas maksimal
      <strong>${MAX_FILE_MB}MB</strong> untuk ${jenis}. Coba kompres atau pilih file yang lebih kecil.
    </p>
    <div class="modal-actions">
      <button id="okBtn" class="btn-primary">Mengerti</button>
    </div>
  `;
  modalOverlay.style.display = 'flex';
  document.getElementById('okBtn').addEventListener('click', closeModal);
}

function openCaptionModal(file) {
  const previewUrl = URL.createObjectURL(file);
  modalBody.innerHTML = `
    <h3>Tambah Foto</h3>
    <img src="${previewUrl}" class="modal-preview"/>
    <label>Keterangan (opsional)</label>
    <input id="captionInput" placeholder="Tulis keterangan..." maxlength="60"/>
    <div class="modal-actions">
      <button id="cancelBtn" class="btn-secondary">Batal</button>
      <button id="saveBtn" class="btn-primary">Simpan</button>
    </div>
  `;
  modalOverlay.style.display = 'flex';
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const caption = document.getElementById('captionInput').value.trim();
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Mengunggah...';
    await uploadPhoto(file, caption);
    URL.revokeObjectURL(previewUrl);
    closeModal();
  });
}

async function uploadPhoto(file, caption) {
  try {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    const { error: insertError } = await supabase.from('photos').insert({
      image_url: publicUrlData.publicUrl,
      storage_path: path,
      caption,
      uploaded_by: session.user.id,
    });
    if (insertError) throw insertError;

    await loadPhotos();
  } catch (err) {
    console.error(err);
    alert('Gagal mengunggah foto: ' + err.message);
  }
}

function confirmDelete(id) {
  modalBody.innerHTML = `
    <h3>Hapus foto ini?</h3>
    <p class="modal-text">Foto akan dihapus untuk semua orang yang melihat galeri ini.</p>
    <div class="modal-actions">
      <button id="cancelBtn" class="btn-secondary">Batal</button>
      <button id="delBtn" class="btn-danger">Hapus</button>
    </div>
  `;
  modalOverlay.style.display = 'flex';
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('delBtn').addEventListener('click', async () => {
    await deletePhoto(id);
    closeModal();
  });
}

async function deletePhoto(id) {
  try {
    const { data: row } = await supabase
      .from('photos')
      .select('storage_path')
      .eq('id', id)
      .single();

    if (row && row.storage_path) {
      await supabase.storage.from(BUCKET).remove([row.storage_path]);
    }

    const { error } = await supabase.from('photos').delete().eq('id', id);
    if (error) throw error;

    await loadPhotos();
  } catch (err) {
    console.error(err);
    alert('Gagal menghapus foto: ' + err.message);
  }
}

function subscribeRealtime() {
  // Supaya galeri otomatis update kalau ada foto baru / dihapus dari sesi lain
  supabase
    .channel('photos-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, () => loadPhotos())
    .subscribe();
}

function closeModal() {
  modalOverlay.style.display = 'none';
  modalBody.innerHTML = '';
}
modalOverlay.addEventListener('click', (e) => {
  if (e.target.id === 'modalOverlay') closeModal();
});

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
