/**
 * Vercel Serverless Function: admin-only password management.
 *
 * Required Vercel environment variables:
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * NEVER expose SUPABASE_SERVICE_ROLE_KEY to browser code.
 */

const json = (body, status = 200) => ({
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  },
  body: JSON.stringify(body),
});

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} belum diatur di Vercel.`);
  return value.replace(/\/$/, '');
}

async function supabaseFetch(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!response.ok) {
    const message = data?.message || data?.error_description || data?.error || `Supabase HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function getCaller(supabaseUrl, anonKey, serviceKey, req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    const error = new Error('Unauthorized');
    error.status = 401;
    throw error;
  }

  const token = auth.slice(7).trim();
  if (!token) {
    const error = new Error('Unauthorized');
    error.status = 401;
    throw error;
  }

  const user = await supabaseFetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
  });

  const rows = await supabaseFetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  );

  if (!rows?.[0] || rows[0].role !== 'admin') {
    const error = new Error('Forbidden: admin only');
    error.status = 403;
    throw error;
  }

  return user;
}

async function listUsers(supabaseUrl, serviceKey) {
  const authUsers = await supabaseFetch(
    `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  );

  const users = Array.isArray(authUsers?.users) ? authUsers.users : [];
  const ids = users.map((u) => u.id).filter(Boolean);
  const profileMap = new Map();

  if (ids.length) {
    // Supabase PostgREST IN syntax. UUIDs are safe to quote after escaping quotes.
    const inList = ids.map((id) => `"${String(id).replaceAll('"', '\\"')}"`).join(',');
    const rows = await supabaseFetch(
      `${supabaseUrl}/rest/v1/profiles?id=in.(${encodeURIComponent(inList)})&select=id,full_name,role`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );
    for (const row of rows || []) profileMap.set(row.id, row);
  }

  return users.map((u) => ({
    id: u.id,
    email: u.email || '',
    full_name: profileMap.get(u.id)?.full_name || u.user_metadata?.full_name || '',
    role: profileMap.get(u.id)?.role || 'visitor',
  }));
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const project = String(req.headers['x-admin-project'] || 'photo').toLowerCase();
    const prefix = project === 'video' ? 'SUPABASE_VIDEO_' : 'SUPABASE_';
    const supabaseUrl = env(`${prefix}URL`);
    const anonKey = env(`${prefix}ANON_KEY`);
    const serviceKey = env(`${prefix}SERVICE_ROLE_KEY`);

    await getCaller(supabaseUrl, anonKey, serviceKey, req);

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = body.action;

    if (action === 'list-users') {
      return res.status(200).json({ users: await listUsers(supabaseUrl, serviceKey) });
    }

    if (action === 'reset-password') {
      const userId = String(body.user_id || '').trim();
      const password = String(body.password || '');

      if (!userId) return res.status(400).json({ error: 'user_id wajib diisi' });
      if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter.' });
      if (password.length > 128) return res.status(400).json({ error: 'Password terlalu panjang.' });

      await supabaseFetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      return res.status(200).json({ ok: true, message: 'Password berhasil diubah oleh admin.' });
    }

    return res.status(400).json({ error: 'Action tidak dikenal.' });
  } catch (error) {
    console.error('admin-password:', error);
    const status = Number(error?.status) || 500;
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: error?.message || 'Terjadi kesalahan di server.',
    });
  }
}


module.exports = handler;
