import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { tenantContextForRequest } from '@/lib/tenant-auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function admin(request: Request) {
  const access = await tenantContextForRequest(request);
  if (!access.ok) return { response: reply({ error: access.error }, access.status), context: null };
  if (access.context.role !== 'admin_empresa') return { response: reply({ error: 'Solo el administrador puede gestionar empleados.' }, 403), context: null };
  return { response: null, context: access.context };
}

export async function GET(request: Request) {
  try {
    const access = await admin(request);
    if (!access.context) return access.response;
    const { data, error } = await supabaseAdmin.rpc('ca46_company_member_list', { p_company_id: access.context.companyId });
    if (error) throw error;
    return reply({ members: data || [] });
  } catch { return reply({ error: 'No se pudieron cargar los usuarios.' }, 500); }
}

export async function POST(request: Request) {
  try {
    const access = await admin(request);
    if (!access.context) return access.response;
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ error: 'Introduce un correo válido.' }, 400);
    const { data: identities, error: lookupError } = await supabaseAdmin.rpc('ca46_employee_identity', { p_email: email });
    if (lookupError) throw lookupError;
    if (identities?.some((item: { company_id: string | null; member_role: string | null }) => item.company_id && (item.company_id !== access.context!.companyId || item.member_role !== 'empleado'))) {
      return reply({ error: 'Ese correo ya tiene otro acceso de empresa. Usa un correo distinto para el empleado; no se cambiarán permisos existentes.' }, 409);
    }
    // The URL carries a one-use Auth invitation token, never a company ID supplied by the employee.
    let userId = identities?.[0]?.user_id as string | undefined;
    let invitationUrl: string | null = null;
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://ca-46.vercel.app';
    if (!userId || !identities?.[0]?.confirmed) {
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'invite', email, options: { data: { signup_source: 'ca46_employee' } } });
      if (error || !data.user || !data.properties?.hashed_token) return reply({ error: 'No se pudo generar la invitación. Si el correo ya está registrado, entra con su contraseña.' }, 409);
      userId = data.user.id;
      invitationUrl = `${origin.replace(/\/$/, '')}/activar-empleado?token_hash=${encodeURIComponent(data.properties.hashed_token)}`;
    }
    const { error: bindError } = await supabaseAdmin.rpc('ca46_bind_employee', { p_admin_id: access.context.userId, p_company_id: access.context.companyId, p_user_id: userId });
    if (bindError) return reply({ error: 'No se pudo asignar el empleado. La cuenta no puede ser administradora ni pertenecer a otra empresa.' }, 409);
    return reply({ ok: true, invitationUrl, loginUrl: `${origin.replace(/\/$/, '')}/empleado/etiquetas`, message: invitationUrl ? 'Invitación creada. Copia el enlace y entrégalo únicamente a ese empleado. Es de un solo uso; si caduca, genera otro.' : 'Empleado activado. Puede entrar con su correo y contraseña.' }, 201);
  } catch { return reply({ error: 'No se pudo crear el acceso de empleado.' }, 500); }
}

export async function PATCH(request: Request) {
  try {
    const access = await admin(request);
    if (!access.context) return access.response;
    const body = await request.json().catch(() => ({}));
    if (!/^[0-9a-f-]{36}$/i.test(String(body.userId)) || typeof body.active !== 'boolean') return reply({ error: 'Usuario o estado no válido.' }, 400);
    const { data, error } = await supabaseAdmin.rpc('ca46_set_employee_active', { p_admin_id: access.context.userId, p_company_id: access.context.companyId, p_user_id: body.userId, p_active: body.active });
    if (error) throw error;
    if (!data) return reply({ error: 'Solo puedes activar o desactivar empleados de tu empresa.' }, 404);
    return reply({ ok: true });
  } catch { return reply({ error: 'No se pudo cambiar el acceso.' }, 500); }
}
