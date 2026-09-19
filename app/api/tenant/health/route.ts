import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { error } = await supabaseAdmin
      .from('companies')
      .select('id', { head: true, count: 'exact' });

    if (error) {
      const relationMissing = /relation .*companies.* does not exist|could not find the table .*companies/i.test(error.message || '');
      return NextResponse.json(
        {
          ok: false,
          schemaReady: false,
          code: relationMissing ? 'MULTITENANT_SCHEMA_NOT_APPLIED' : 'MULTITENANT_SCHEMA_UNAVAILABLE',
        },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(
      { ok: true, schemaReady: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, schemaReady: false, code: 'MULTITENANT_HEALTH_FAILED' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
