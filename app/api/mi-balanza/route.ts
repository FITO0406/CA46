import { NextResponse } from 'next/server';
import { tenantContextForRequest } from '@/lib/tenant-auth-server';
import { supabaseAdmin } from '@/lib/supabase';
import { decodeTraceability } from '@/lib/traceability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Read-only inventory preview scoped to the current company.
 * ETPOS writes, article mappings and family assignments are not enabled.
 */
export async function GET(request: Request) {
  const access = await tenantContextForRequest(request);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const companyId = access.context.companyId;
  const { data: tags, error } = await supabaseAdmin.from('digital_tags')
    .select('id,product_name,category,source,status,created_at,expires_at,parent_tag_id,is_active')
    .eq('company_id', companyId).order('created_at', { ascending: false }).limit(300);
  if (error) return NextResponse.json({ error: 'No se pudo consultar las etiquetas.' }, { status: 500 });
  const result = (tags || []).map(tag => {
    let lot = '';
    try { lot = String(decodeTraceability(tag.category || '').lot || ''); } catch { /* optional metadata */ }
    const expired = Boolean(tag.expires_at && new Date(tag.expires_at).getTime() <= Date.now());
    return {
      id: tag.id,
      name: tag.product_name,
      type: tag.source === 'kitchen' ? 'Cocina · hija' : 'Etiqueta',
      source: tag.source,
      lot,
      parentTagId: tag.parent_tag_id,
      createdAt: tag.created_at,
      expiresAt: tag.expires_at,
      state: !tag.is_active ? 'Inactiva' : expired ? 'Vencida' : 'Sin sincronizar',
    };
  });
  return NextResponse.json({ ready: false, connection: 'Sin configurar', tags: result },
    { headers: { 'Cache-Control': 'no-store' } });
}
