import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { superAdminContextForRequest } from '@/lib/superadmin-auth-server';
import { collectDirectorSnapshot } from '@/lib/director-tools-server';
import { openAIConfigured } from '@/lib/director-openai-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    const [settings, snapshot, actions, audit] = await Promise.all([
      supabaseAdmin.from('director_settings').select('enabled,updated_at').eq('id', true).single(),
      collectDirectorSnapshot(),
      supabaseAdmin.from('director_action_proposals').select('id,code,summary,risk_level,status,expires_at,created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(20),
      supabaseAdmin.from('director_audit_log').select('id,occurred_at,event_type,action_key,result_status,authorization_required').order('occurred_at', { ascending: false }).limit(20),
    ]);
    if (settings.error) throw settings.error;
    if (actions.error) throw actions.error;
    if (audit.error) throw audit.error;
    return NextResponse.json({ ok: true, enabled: settings.data.enabled, updatedAt: settings.data.updated_at, openAIConfigured: openAIConfigured(), snapshot, pendingActions: actions.data || [], recentAudit: audit.data || [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('director/status error:', error);
    return NextResponse.json({ ok: false, error: 'No se pudo consultar DIRECTOR CA46.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    const body = await request.json().catch(() => ({}));
    if (typeof body.enabled !== 'boolean') return NextResponse.json({ ok: false, error: 'Estado no válido.' }, { status: 400 });
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from('director_settings').update({ enabled: body.enabled, updated_at: now, updated_by_user_id: access.context.userId }).eq('id', true);
    if (error) throw error;
    await supabaseAdmin.from('director_audit_log').insert({ super_admin_user_id: access.context.userId, event_type: 'control', action_key: body.enabled ? 'director_enabled' : 'director_disabled', reason: body.enabled ? 'Activación manual por SuperAdmin' : 'Apagado manual por SuperAdmin', tool_name: 'director_power_control', result_status: 'success', authorization_required: false, metadata: { enabled: body.enabled } });
    return NextResponse.json({ ok: true, enabled: body.enabled, updatedAt: now });
  } catch (error) {
    console.error('director/status patch error:', error);
    return NextResponse.json({ ok: false, error: 'No se pudo cambiar el estado del Director.' }, { status: 500 });
  }
}
