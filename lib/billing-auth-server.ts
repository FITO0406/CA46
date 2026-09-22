import { supabaseAdmin } from '@/lib/supabase';

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

export async function billingAdminContextForRequest(request: Request): Promise<
  | { ok: true; context: { userId: string; email: string; companyId: string; companyName: string; plan: string } }
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
  if (!membership || membership.role !== 'admin_empresa') {
    return { ok: false, status: 403, error: 'Solo el administrador de empresa puede gestionar la suscripción.' };
  }

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('id, name, plan, status')
    .eq('id', membership.company_id)
    .maybeSingle();

  if (companyError) throw companyError;
  if (!company) return { ok: false, status: 404, error: 'Empresa no encontrada.' };
  if (company.status === 'cancelled') return { ok: false, status: 403, error: 'La empresa está cancelada.' };

  return {
    ok: true,
    context: {
      userId: authData.user.id,
      email: authData.user.email || '',
      companyId: company.id,
      companyName: company.name,
      plan: company.plan,
    },
  };
}
