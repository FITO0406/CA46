import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { archiveCompanyLabels } from '@/lib/company-drive-archive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: companies, error } = await supabaseAdmin.from('company_settings').select('company_id').eq('drive_connected', true);
  if (error) return NextResponse.json({ error: 'No se pudo consultar Drive.' }, { status: 503 });
  const results = await Promise.all((companies || []).map(async ({ company_id }) => {
    try { return { companyId: company_id, ...await archiveCompanyLabels(company_id, 30) }; }
    catch { return { companyId: company_id, error: 'Drive pendiente de conexión o configuración.' }; }
  }));
  return NextResponse.json({ results }, { headers: { 'Cache-Control': 'no-store' } });
}
