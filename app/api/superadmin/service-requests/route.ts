import { NextResponse } from 'next/server';
import { superAdminContextForRequest } from '@/lib/superadmin-auth-server';
import { supabaseAdmin } from '@/lib/supabase';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers });
    const { data, error } = await supabaseAdmin.from('company_service_requests')
      .select('id,company_id,requester_email,kind,message,status,response,created_at,due_at,updated_at').in('status', ['pendiente', 'en_revision']).order('created_at').limit(200);
    if (error) throw error;
    return NextResponse.json({ requests: data }, { headers });
  } catch { return NextResponse.json({ error: 'No se pudo consultar la bandeja.' }, { status: 503, headers }); }
}
export async function PATCH(request: Request) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers });
    const body = await request.json();
    const response = String(body.response || '').trim();
    if (!/^[a-f0-9-]{36}$/i.test(body.id || '') || !['pendiente', 'en_revision', 'resuelta'].includes(body.status) || response.length > 4000 || (body.status === 'resuelta' && response.length < 10)) return NextResponse.json({ error: 'Revisa el identificador, el estado y la respuesta (mínimo 10 caracteres para resolver).' }, { status: 400, headers });
    const { data, error } = await supabaseAdmin.rpc('ca46_update_service_request', { p_actor_id: access.context.userId, p_request_id: body.id, p_status: body.status, p_response: response });
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Solicitud no encontrada.' }, { status: 404, headers });
    return NextResponse.json({ ok: true }, { headers });
  } catch { return NextResponse.json({ error: 'No se pudo registrar el seguimiento.' }, { status: 503, headers }); }
}
