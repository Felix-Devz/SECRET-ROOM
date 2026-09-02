import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const userClient = createClient(supabaseUrl, anonKey);
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.slice('Bearer '.length);
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) throw new Error('Unauthorized');

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    throw new Error('Forbidden: admin only');
  }

  return data.user;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    await requireAdmin(req);

    const body = await req.json();
    const action = body?.action;

    if (action === 'list-users') {
      const { data: usersData, error } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (error) throw error;

      const users = usersData.users || [];
      const ids = users.map((u) => u.id);
      let profiles: Record<string, { full_name: string | null; role: string | null }> = {};

      if (ids.length) {
        const { data: rows, error: profileError } = await adminClient
          .from('profiles')
          .select('id, full_name, role')
          .in('id', ids);
        if (profileError) throw profileError;
        profiles = Object.fromEntries((rows || []).map((p) => [p.id, p]));
      }

      return json({
        users: users.map((u) => ({
          id: u.id,
          email: u.email || '',
          full_name: profiles[u.id]?.full_name || u.user_metadata?.full_name || '',
          role: profiles[u.id]?.role || 'visitor',
        })),
      });
    }

    if (action === 'reset-password') {
      const userId = String(body?.user_id || '');
      const password = String(body?.password || '');

      if (!userId) return json({ error: 'user_id wajib diisi' }, 400);
      if (password.length < 6) return json({ error: 'Password minimal 6 karakter.' }, 400);
      if (password.length > 128) return json({ error: 'Password terlalu panjang.' }, 400);

      const { error } = await adminClient.auth.admin.updateUserById(userId, { password });
      if (error) throw error;

      return json({ ok: true, message: 'Password berhasil diubah oleh admin.' });
    }

    return json({ error: 'Action tidak dikenal.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan.';
    const status = message.startsWith('Unauthorized') ? 401 : message.startsWith('Forbidden') ? 403 : 400;
    return json({ error: message }, status);
  }
});
