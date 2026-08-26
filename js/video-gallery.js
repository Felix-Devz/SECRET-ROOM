import { supabaseVideo as supabase } from './supabaseClientVideo.js';

const BUCKET = 'class-videos';
const MAX_FILE_MB = 50;

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
  lightboxContent.innerHTML = `<video src="${url}" controls autoplay></video>`;
  lightboxOverlay.style.display = 'flex';
}
function closeLightbox() {
  lightboxContent.querySelectorAll('video').forEach((v) => v.pause());
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
    window.location.href = 'login.html#tipe=video';
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

  await loadVideos();
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

async function loadVideos() {
  const { data, error } = await supabase
    .from('videos')
    .select('id, video_url, caption, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    grid.innerHTML = '<div class="empty-state">Gagal memuat video. Coba muat ulang halaman.</div>';
    return;
  }
  renderGrid(data || []);
}

function renderGrid(videos) {
  grid.innerHTML = '';

  const canUpload = profile.role === 'admin' || profile.role === 'uploader';
  const canDelete = profile.role === 'admin';

  if (canUpload) {
    const tile = document.createElement('div');
    tile.className = 'upload-tile';
    tile.innerHTML = '<span class="plus">+</span><span>Tambah Video</span>';
    tile.addEventListener('click', () => fileInput.click());
    grid.appendChild(tile);
  }

  if (videos.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = canUpload
      ? 'Belum ada video. Klik "+ Tambah Video" untuk mengunggah momen pertama!'
      : 'Belum ada video. Nantikan admin mengunggah momen pertama!';
    grid.appendChild(empty);
    return;
  }

  videos.forEach((video) => {
    const card = document.createElement('div');
    card.className = 'polaroid';
    card.style.setProperty('--r', (Math.random() * 6 - 3) + 'deg');
    card.innerHTML = `
      <div class="photo-frame"><video src="${video.video_url}" controls preload="metadata"></video></div>
      <div class="caption">${video.caption ? escapeHtml(video.caption) : '&nbsp;'}</div>
      <button class="expand-btn" title="Perbesar">⤢</button>
      ${canDelete ? '<button class="del-btn" title="Hapus">✕</button>' : ''}
    `;
    card.querySelector('.expand-btn').addEventListener('click', () => openLightbox(video.video_url, video.caption));
    if (canDelete) {
      card.querySelector('.del-btn').addEventListener('click', () => confirmDelete(video.id));
    }
    grid.appendChild(card);
  });
}

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;

  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    showSizeWarning(file, 'video');
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
    <h3>Tambah Video</h3>
    <video src="${previewUrl}" class="modal-preview" controls></video>
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
    await uploadVideo(file, caption);
    URL.revokeObjectURL(previewUrl);
    closeModal();
  });
}

async function uploadVideo(file, caption) {
  try {
    const ext = file.name.split('.').pop() || 'mp4';
    const path = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    const { error: insertError } = await supabase.from('videos').insert({
      video_url: publicUrlData.publicUrl,
      storage_path: path,
      caption,
      uploaded_by: session.user.id,
    });
    if (insertError) throw insertError;

    await loadVideos();
  } catch (err) {
    console.error(err);
    alert('Gagal mengunggah video: ' + err.message);
  }
}

function confirmDelete(id) {
  modalBody.innerHTML = `
    <h3>Hapus video ini?</h3>
    <p class="modal-text">Video akan dihapus untuk semua orang yang melihat galeri ini.</p>
    <div class="modal-actions">
      <button id="cancelBtn" class="btn-secondary">Batal</button>
      <button id="delBtn" class="btn-danger">Hapus</button>
    </div>
  `;
  modalOverlay.style.display = 'flex';
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('delBtn').addEventListener('click', async () => {
    await deleteVideo(id);
    closeModal();
  });
}

async function deleteVideo(id) {
  try {
    const { data: row } = await supabase
      .from('videos')
      .select('storage_path')
      .eq('id', id)
      .single();

    if (row && row.storage_path) {
      await supabase.storage.from(BUCKET).remove([row.storage_path]);
    }

    const { error } = await supabase.from('videos').delete().eq('id', id);
    if (error) throw error;

    await loadVideos();
  } catch (err) {
    console.error(err);
    alert('Gagal menghapus video: ' + err.message);
  }
}

function subscribeRealtime() {
  // Supaya galeri otomatis update kalau ada video baru / dihapus dari sesi lain
  supabase
    .channel('videos-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, () => loadVideos())
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
