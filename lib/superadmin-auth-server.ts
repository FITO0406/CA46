import { supabaseAdmin } from '@/lib/supabase';

export type SuperAdminContext = {
  userId: string;
  email: string;
  displayName: string;
};

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

export async function superAdminContextForRequest(request: Request): Promise<
  | { ok: true; context: SuperAdminContext }
  | { ok: false; status: number; error: string }
> {
  const token = bearerToken(request);
  if (!token) return { ok: false, status: 401, error: 'No autorizado.' };

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return { ok: false, status: 401, error: 'No autorizado.' };

  const { data: superAdmin, error: superAdminError } = await supabaseAdmin
    .from('super_admins')
    .select('display_name, is_active')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (superAdminError) throw superAdminError;
  if (!superAdmin || !superAdmin.is_active) {
    return { ok: false, status: 403, error: 'Esta cuenta no tiene acceso SuperAdmin.' };
  }

  return {
    ok: true,
    context: {
      userId: authData.user.id,
      email: authData.user.email || '',
      displayName: String(superAdmin.display_name || '').trim(),
    },
  };
}
