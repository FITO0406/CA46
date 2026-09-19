import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

async function authenticatedUser(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function activeMembership(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('company_members')
    .select('company_id, role, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function toClient(row: any) {
  if (!row) return null;
  return {
    businessName: row.business_name || '',
    legalName: row.legal_name || '',
    taxId: row.tax_id || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    postalCode: row.postal_code || '',
    city: row.city || '',
    province: row.province || '',
    contactFirstName: row.contact_first_name || '',
    contactLastName: row.contact_last_name || '',
    contactPhone: row.contact_phone || '',
    contactEmail: row.contact_email || '',
    selectedBankIds: Array.isArray(row.selected_bank_ids) ? row.selected_bank_ids : [],
    screenName: row.screen_name || '',
    labelsHours: row.labels_hours || 72,
    publicScreenEnabled: Boolean(row.public_screen_enabled),
    publicScreenToken: row.public_screen_token || '',
    driveConnected: Boolean(row.drive_connected),
    driveFolderId: row.drive_folder_id || '',
    driveFolderUrl: row.drive_folder_url || '',
  };
}

function cleanArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

export async function GET(request: Request) {
  try {
    const user = await authenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

    const membership = await activeMembership(user.id);
    if (!membership) {
      return NextResponse.json({ ok: true, settings: null, code: 'TENANT_REQUIRED' }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const { data, error } = await supabaseAdmin
      .from('company_settings')
      .select('*')
      .eq('company_id', membership.company_id)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json(
      { ok: true, companyId: membership.company_id, role: membership.role, settings: toClient(data) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'No se pudo cargar la configuración.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await authenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

    const membership = await activeMembership(user.id);
    if (!membership) return NextResponse.json({ error: 'Primero debes crear o activar tu empresa.' }, { status: 409 });
    if (membership.role !== 'admin_empresa') return NextResponse.json({ error: 'Solo el administrador puede modificar Mi empresa.' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const labelsHours = Math.max(1, Math.min(720, Number(body?.labelsHours || 72)));

    const record = {
      company_id: membership.company_id,
      business_name: String(body?.businessName || '').trim(),
      legal_name: String(body?.legalName || '').trim(),
      tax_id: String(body?.taxId || '').trim(),
      phone: String(body?.phone || '').trim(),
      email: String(body?.email || '').trim(),
      address: String(body?.address || '').trim(),
      postal_code: String(body?.postalCode || '').trim(),
      city: String(body?.city || '').trim(),
      province: String(body?.province || '').trim(),
      contact_first_name: String(body?.contactFirstName || '').trim(),
      contact_last_name: String(body?.contactLastName || '').trim(),
      contact_phone: String(body?.contactPhone || '').trim(),
      contact_email: String(body?.contactEmail || '').trim(),
      selected_bank_ids: cleanArray(body?.selectedBankIds),
      screen_name: String(body?.screenName || '').trim(),
      labels_hours: labelsHours,
      public_screen_enabled: Boolean(body?.publicScreenEnabled),
      drive_connected: Boolean(body?.driveConnected),
      drive_folder_id: String(body?.driveFolderId || '').trim(),
      drive_folder_url: String(body?.driveFolderUrl || '').trim(),
    };

    const { data, error } = await supabaseAdmin
      .from('company_settings')
      .upsert(record, { onConflict: 'company_id' })
      .select('*')
      .single();

    if (error) throw error;

    if (record.business_name) {
      await supabaseAdmin
        .from('companies')
        .update({ name: record.business_name })
        .eq('id', membership.company_id);
    }

    return NextResponse.json(
      { ok: true, companyId: membership.company_id, settings: toClient(data) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar la configuración.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
