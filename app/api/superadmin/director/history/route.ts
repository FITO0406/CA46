import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { superAdminContextForRequest } from '@/lib/superadmin-auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    const { data: conversation, error } = await supabaseAdmin.from('director_conversations').select('id').eq('super_admin_user_id', access.context.userId).maybeSingle();
    if (error) throw error;
    if (!conversation) return NextResponse.json({ ok: true, messages: [] });
    const { data, error: messagesError } = await supabaseAdmin.from('director_messages').select('id,role,content,sources,created_at').eq('conversation_id', conversation.id).order('created_at', { ascending: true }).limit(200);
    if (messagesError) throw messagesError;
    return NextResponse.json({ ok: true, messages: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('director/history error:', error);
    return NextResponse.json({ ok: false, error: 'No se pudo cargar el historial.' }, { status: 500 });
  }
}
