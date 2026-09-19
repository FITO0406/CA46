import { supabaseAdmin } from '@/lib/supabase';

export type TenantRequestContext = {
  userId: string;
  companyId: string;
  companyName: string;
  companyStatus: string;
  role: string;
};

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

export async function tenantContextForRequest(request: Request): Promise<
  | { ok: true; context: TenantRequestContext }
  | { ok: false; status: number; error: string }
> {
  const token = bearerToken(request);
  if (!token) return { ok: false, status: 401, error: 'No autorizado.' };

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return { ok: false, status: 401, error: 'No autorizado.' };

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_members')
    .select('company_id, role, is_active')
    .eq('user_id', authData.user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) return { ok: false, status: 409, error: 'Primero debes activar tu empresa.' };

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('id, name, status')
    .eq('id', membership.company_id)
    .single();

  if (companyError) throw companyError;
  if (!['active', 'trial'].includes(company.status)) {
    return { ok: false, status: 403, error: 'La empresa no está activa.' };
  }

  return {
    ok: true,
    context: {
      userId: authData.user.id,
      companyId: company.id,
      companyName: company.name,
      companyStatus: company.status,
      role: membership.role,
    },
  };
}
