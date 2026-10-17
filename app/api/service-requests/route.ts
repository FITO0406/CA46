import { NextResponse } from 'next/server';
import { serviceContext } from '@/lib/service-auth-server';
import { supabaseAdmin } from '@/lib/supabase';
import { validateServiceRequest, rightsDueAt } from '@/lib/service-requests';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  try {
    const ctx = await serviceContext(request);
    if (!ctx) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401, headers });
    const { data, error } = await supabaseAdmin.from('company_service_requests')
      .select('id,kind,message,status,response,created_at,due_at,updated_at').eq('user_id', ctx.userId).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ requests: data, canManageCompany: ctx.isAdmin, email: ctx.email }, { headers });
  } catch {
    return NextResponse.json({ error: 'No se pudieron consultar las solicitudes. Puedes escribir al contacto de soporte.' }, { status: 503, headers });
  }
}
export async function POST(request: Request) {
  try {
    const ctx = await serviceContext(request);
    if (!ctx || !ctx.confirmed) return NextResponse.json({ error: 'Inicia sesión con un correo confirmado.' }, { status: 401, headers });
    if (Number(request.headers.get('content-length') || 0) > 12000) return NextResponse.json({ error: 'Solicitud demasiado larga.' }, { status: 413, headers });
    const input = await validateServiceRequest(await request.json(), ctx.isAdmin);
    if (!input) return NextResponse.json({ error: 'Selecciona una solicitud permitida y escribe entre 10 y 4.000 caracteres.' }, { status: 400, headers });
    const now = new Date();
    // The RPC uses a per-user lock: concurrent requests cannot bypass this limit.
    const { data, error } = await supabaseAdmin.rpc('ca46_create_service_request', {
      p_user_id: ctx.userId, p_company_id: ctx.companyId || null, p_email: ctx.email,
      p_kind: input.kind, p_message: input.message, p_due_at: input.kind === 'derechos' ? rightsDueAt(now) : null,
    });
    if (error?.code === 'P0001') return NextResponse.json({ error: 'Ya has enviado varias solicitudes. Espera una hora o utiliza el contacto de soporte.' }, { status: 429, headers });
    if (error) throw error;
    return NextResponse.json({ ok: true, request: data, message: 'Solicitud registrada. La baja o restauración requiere revisión; todavía no se han modificado tus datos.' }, { status: 201, headers });
  } catch {
    return NextResponse.json({ error: 'No se pudo registrar. Contacta con soporte por correo; este intento no constituye un justificante de recepción.' }, { status: 503, headers });
  }
}
