import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) {
      return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user?.email) {
      return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }

    const email = authData.user.email.trim().toLowerCase();
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('super_admin_invites')
      .select('display_name, is_active')
      .eq('email', email)
      .maybeSingle();

    if (inviteError) throw inviteError;
    if (!invite?.is_active) {
      return NextResponse.json(
        { ok: false, error: 'Este email no está autorizado como SuperAdmin.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const { data: superAdmin, error: upsertError } = await supabaseAdmin
      .from('super_admins')
      .upsert(
        {
          user_id: authData.user.id,
          display_name: String(invite.display_name || '').trim(),
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('display_name, is_active')
      .single();

    if (upsertError) throw upsertError;

    return NextResponse.json(
      {
        ok: true,
        superAdmin: {
          userId: authData.user.id,
          email,
          displayName: superAdmin.display_name || '',
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('superadmin/bootstrap error:', error);
    return NextResponse.json(
      { ok: false, error: 'No se pudo activar el acceso SuperAdmin.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
