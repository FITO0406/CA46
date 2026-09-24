import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { superAdminContextForRequest } from '@/lib/superadmin-auth-server';
import { collectDirectorSnapshot, deterministicBriefing, DIRECTOR_TOOL_NAMES } from '@/lib/director-tools-server';
import { generateDirectorAnswer } from '@/lib/director-openai-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function fallbackAnswer(message: string, snapshot: Awaited<ReturnType<typeof collectDirectorSnapshot>>) {
  const normalized = message.toLocaleLowerCase('es-ES');
  if (normalized.includes('cuántas empresas') || normalized.includes('cuantas empresas')) return `Actualmente hay ${snapshot.companies.total} empresas registradas: ${snapshot.companies.active} activas, ${snapshot.companies.trial} en prueba y ${snapshot.companies.suspended} suspendidas.`;
  if (normalized.includes('incidencia') || normalized.includes('problema')) return snapshot.incidents.length ? `He detectado ${snapshot.incidents.length} avisos:\n${snapshot.incidents.map((x) => `• ${x.title}: ${x.detail}`).join('\n')}` : 'No hay incidencias detectadas por las fuentes conectadas.';
  if (normalized.includes('temperatura')) return `En las últimas 24 horas hay ${snapshot.operations.readings24h} lecturas y ${snapshot.operations.temperatureAlerts24h} fuera de rango, sobre ${snapshot.operations.equipment} equipos de frío activos.`;
  return `Estado verificado de CA46: ${snapshot.companies.total} empresas, ${snapshot.operations.activeMembers} usuarios activos, ${snapshot.operations.activeTags} etiquetas activas y ${snapshot.incidents.length} avisos. La conexión OpenAI no está configurada, por lo que esta respuesta se ha generado con el modo seguro de datos estructurados.`;
}

export async function POST(request: Request) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    const body = await request.json().catch(() => ({}));
    const message = String(body.message || '').trim();
    if (!message || message.length > 4000) return NextResponse.json({ ok: false, error: 'Escribe un mensaje válido de hasta 4.000 caracteres.' }, { status: 400 });

    const { data: settings, error: settingsError } = await supabaseAdmin.from('director_settings').select('enabled').eq('id', true).single();
    if (settingsError) throw settingsError;
    if (!settings.enabled) {
      await supabaseAdmin.from('director_audit_log').insert({ super_admin_user_id: access.context.userId, event_type: 'access', action_key: 'chat_blocked_director_off', reason: 'Director apagado manualmente', result_status: 'denied', authorization_required: false });
      return NextResponse.json({ ok: false, error: 'DIRECTOR CA46 está apagado. Actívalo manualmente para conversar.' }, { status: 423 });
    }

    const { data: conversation, error: conversationError } = await supabaseAdmin.from('director_conversations').upsert({ super_admin_user_id: access.context.userId, updated_at: new Date().toISOString() }, { onConflict: 'super_admin_user_id' }).select('id').single();
    if (conversationError) throw conversationError;
    const { data: history, error: historyError } = await supabaseAdmin.from('director_messages').select('role,content').eq('conversation_id', conversation.id).order('created_at', { ascending: false }).limit(14);
    if (historyError) throw historyError;
    await supabaseAdmin.from('director_messages').insert({ conversation_id: conversation.id, role: 'user', content: message });

    const snapshot = await collectDirectorSnapshot();
    const isMeeting = /buenos d[ií]as.*(director|reuni[oó]n)|comenzamos la reuni[oó]n|reuni[oó]n diaria/i.test(message);
    let answer = '';
    let briefingId: string | null = null;
    if (isMeeting) {
      const { data: last } = await supabaseAdmin.from('director_daily_briefings').select('created_at').eq('super_admin_user_id', access.context.userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const base = deterministicBriefing(snapshot, last?.created_at || null);
      answer = (await generateDirectorAnswer(`Convierte este briefing determinista en una reunión ejecutiva de unos 5 minutos, manteniendo exactamente las cifras y los apartados CRÍTICO, IMPORTANTE, MEJORA, OPORTUNIDAD y PRIORIDADES:\n${base}`, snapshot, [])) || base;
      const { data: briefing } = await supabaseAdmin.from('director_daily_briefings').insert({ super_admin_user_id: access.context.userId, period_from: last?.created_at || null, content: answer, snapshot }).select('id').single();
      briefingId = briefing?.id || null;
    } else {
      answer = (await generateDirectorAnswer(message, snapshot, (history || []).reverse())) || fallbackAnswer(message, snapshot);
    }

    const sources = [{ tool: 'consultar_estado_sistema', checkedAt: snapshot.checkedAt }, { tool: 'consultar_empresas', checkedAt: snapshot.checkedAt }, { tool: 'consultar_incidencias', checkedAt: snapshot.checkedAt }];
    const { data: saved, error: saveError } = await supabaseAdmin.from('director_messages').insert({ conversation_id: conversation.id, role: 'assistant', content: answer, sources }).select('id,created_at').single();
    if (saveError) throw saveError;
    await supabaseAdmin.from('director_audit_log').insert({ super_admin_user_id: access.context.userId, event_type: isMeeting ? 'briefing' : 'consultation', action_key: isMeeting ? 'daily_meeting' : 'director_chat', reason: message.slice(0, 240), tool_name: DIRECTOR_TOOL_NAMES.join(','), result_status: 'success', authorization_required: false, metadata: { briefingId, sources } });

    return NextResponse.json({ ok: true, message: { id: saved.id, role: 'assistant', content: answer, sources, created_at: saved.created_at }, snapshot, briefingId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('director/chat error:', error);
    return NextResponse.json({ ok: false, error: 'DIRECTOR CA46 no pudo completar la consulta. No se ha ejecutado ninguna acción.' }, { status: 500 });
  }
}
