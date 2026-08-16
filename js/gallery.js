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

init();

async function init() {
  const { data: { session: s } } = await supabase.auth.getSession();
  if (!s) {
    window.location.href = 'index.html';
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

  roleBadge.textContent = profile.role === 'admin' ? '👑 Admin' : '🙋 Pengunjung';

  await loadPhotos();
  subscribeRealtime();
}

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
});

changePasswordBtn.addEventListener('click', openChangePasswordModal);

function openChangePasswordModal() {
  modalBody.innerHTML = `
    <h3>Ubah Password</h3>
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
  document.getElementById('savePasswordBtn').addEventListener('click', submitChangePassword);
}

async function submitChangePassword() {
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const errorEl = document.getElementById('passwordError');
  const saveBtn = document.getElementById('savePasswordBtn');
  errorEl.textContent = '';

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

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  saveBtn.disabled = false;
  saveBtn.textContent = 'Simpan';

  if (error) {
    errorEl.textContent = 'Gagal mengubah password: ' + error.message;
    return;
  }

  closeModal();
  alert('Password berhasil diubah. Silakan login ulang dengan password baru.');
  await supabase.auth.signOut();
  window.location.href = 'index.html';
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

  if (profile.role === 'admin') {
    const tile = document.createElement('div');
    tile.className = 'upload-tile';
    tile.innerHTML = '<span class="plus">+</span><span>Tambah Foto</span>';
    tile.addEventListener('click', () => fileInput.click());
    grid.appendChild(tile);
  }

  if (photos.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = profile.role === 'admin'
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
      ${profile.role === 'admin' ? '<button class="del-btn" title="Hapus">✕</button>' : ''}
    `;
    if (profile.role === 'admin') {
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
    alert(`Ukuran foto maksimal ${MAX_FILE_MB}MB ya.`);
    return;
  }
  openCaptionModal(file);
});

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
}  await loadPhotos();
  subscribeRealtime();
}

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
});

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

  if (profile.role === 'admin') {
    const tile = document.createElement('div');
    tile.className = 'upload-tile';
    tile.innerHTML = '<span class="plus">+</span><span>Tambah Foto</span>';
    tile.addEventListener('click', () => fileInput.click());
    grid.appendChild(tile);
  }

  if (photos.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = profile.role === 'admin'
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
      ${profile.role === 'admin' ? '<button class="del-btn" title="Hapus">✕</button>' : ''}
    `;
    if (profile.role === 'admin') {
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
    alert(`Ukuran foto maksimal ${MAX_FILE_MB}MB ya.`);
    return;
  }
  openCaptionModal(file);
});

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
