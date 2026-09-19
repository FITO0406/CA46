import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function publicCompanyFromScreenToken(screenToken: string) {
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('company_settings')
    .select('company_id, public_screen_enabled')
    .eq('public_screen_token', screenToken)
    .maybeSingle();

  if (settingsError) throw settingsError;
  if (!settings?.company_id || !settings.public_screen_enabled) return null;

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('id, status')
    .eq('id', settings.company_id)
    .maybeSingle();

  if (companyError) throw companyError;
  if (!company || !['active', 'trial'].includes(company.status)) return null;

  return company.id as string;
}

export async function GET(request: Request) {
  try {
    const screenToken = new URL(request.url).searchParams.get('screen')?.trim() || '';

    if (screenToken) {
      const companyId = await publicCompanyFromScreenToken(screenToken);
      if (!companyId) {
        return NextResponse.json([], { status: 200, headers: { 'Cache-Control': 'no-store' } });
      }

      const { data, error } = await supabaseAdmin
        .from('digital_tags')
        .select('id, drive_file_id, product_name, origin, category, is_active, created_at, expires_at, source, status')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      return NextResponse.json(data || [], {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    // Compatibilidad temporal: solo muestra antiguas etiquetas sin empresa.
    const { data, error } = await supabase
      .from('digital_tags')
      .select('id, drive_file_id, product_name, origin, category, is_active, created_at, expires_at, source, status')
      .is('company_id', null)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || [], {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error: any) {
    console.error('GET digital-tags error:', error);
    return NextResponse.json(
      { error: 'No se pudieron cargar las etiquetas.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
