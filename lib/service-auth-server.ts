import { supabaseAdmin } from '@/lib/supabase';

// Rights and data return remain available when the commercial service is suspended.
// Company and role are read from the database, never from metadata or the request body.
export async function serviceContext(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: memberships, error: membershipError } = await supabaseAdmin.from('company_members')
    .select('company_id,role,is_active').eq('user_id', data.user.id).limit(2);
  if (membershipError) throw membershipError;
  // Ambiguous memberships require manual identification; do not select an arbitrary tenant.
  const active = (memberships || []).filter(member => member.is_active);
  const membership = active.length === 1 ? active[0] : null;
  return { userId: data.user.id, email: data.user.email || '', companyId: membership?.company_id as string | undefined,
    isAdmin: membership?.role === 'admin_empresa', confirmed: Boolean(data.user.email_confirmed_at) };
}
