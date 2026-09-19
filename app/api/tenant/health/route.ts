import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const checks = await Promise.all([
      supabaseAdmin.from('companies').select('id', { head: true, count: 'exact' }),
      supabaseAdmin.from('company_members').select('company_id', { head: true, count: 'exact' }),
      supabaseAdmin.from('company_settings').select('company_id', { head: true, count: 'exact' }),
      supabaseAdmin.from('digital_tags').select('company_id', { head: true, count: 'exact' }),
    ]);

    const firstError = checks.map((result) => result.error).find(Boolean);
    if (firstError) {
      const relationMissing = /relation .* does not exist|could not find the table/i.test(firstError.message || '');
      return NextResponse.json(
        {
          ok: false,
          schemaReady: false,
          tenantSettingsReady: false,
          tenantTagsReady: false,
          code: relationMissing ? 'MULTITENANT_SCHEMA_NOT_APPLIED' : 'MULTITENANT_SCHEMA_UNAVAILABLE',
        },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        schemaReady: true,
        tenantSettingsReady: true,
        tenantTagsReady: true,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        schemaReady: false,
        tenantSettingsReady: false,
        tenantTagsReady: false,
        code: 'MULTITENANT_HEALTH_FAILED',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
