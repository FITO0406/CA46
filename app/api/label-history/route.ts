import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { tenantContextForRequest } from '@/lib/tenant-auth-server';
import { driveHistoryDocument } from '@/lib/company-drive-archive';
import { driveHistoryPdf } from '@/lib/company-drive-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const FIELDS = 'id,product_name,origin,category,source,status,is_active,created_at,expires_at,annulled_at,annulled_reason';

export async function GET(request: Request) {
  try {
    const tenant = await tenantContextForRequest(request);
    if (!tenant.ok) return NextResponse.json({ error: tenant.error }, { status: tenant.status, headers });
    const params = new URL(request.url).searchParams;
    const cutoff = new Date(Date.now() - 15 * 86400000).toISOString();
    let query = supabaseAdmin.from('digital_tags').select(FIELDS)
      .eq('company_id', tenant.context.companyId).or('source.neq.kitchen,source.is.null').gte('created_at', cutoff);
    const id = params.get('id');
    if (id) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return NextResponse.json({ error: 'Identificador incorrecto.' }, { status: 400, headers });
      }
      const { data, error } = await query.eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'La etiqueta no está disponible en el historial de esta empresa.' }, { status: 404, headers });
      const document = JSON.parse(driveHistoryDocument(data, tenant.context.companyName));
      document.nota = 'Copia recuperada del historial. Conserva las fechas originales y no reinicia la vigencia ni la vida útil del producto.';
      const pdf = driveHistoryPdf(JSON.stringify(document));
      return new Response(new Uint8Array(pdf), { headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="CA46_etiqueta_${id}.pdf"` } });
    }
    const page = Number(params.get('page') || 0);
    if (!Number.isSafeInteger(page) || page < 0 || page > 10000) return NextResponse.json({ error: 'Página incorrecta.' }, { status: 400, headers });
    const type = params.get('type');
    if (type === '24') query = query.eq('source', 'physical_label');
    if (type === '72') query = query.eq('source', 'invoice');
    const date = params.get('date');
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) return NextResponse.json({ error: 'Fecha incorrecta.' }, { status: 400, headers });
      const midnight = (day: string) => {
        const offset = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Madrid', timeZoneName: 'shortOffset' }).formatToParts(new Date(`${day}T00:00:00Z`)).find(part => part.type === 'timeZoneName')?.value === 'GMT+2' ? '+02:00' : '+01:00';
        return new Date(`${day}T00:00:00${offset}`).toISOString();
      };
      const nextDay = new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10);
      query = query.gte('created_at', midnight(date)).lt('created_at', midnight(nextDay));
    }
    const search = (params.get('q') || '').slice(0, 120).replace(/[^\p{L}\p{N}\s_-]/gu, ' ').trim().replace(/[_%]/g, '\\$&');
    if (search) query = query.or(`product_name.ilike.%${search}%,category.ilike.%${search}%,origin.ilike.%${search}%`);
    const { data, error } = await query.order('created_at', { ascending: false }).order('id').range(page * 100, page * 100 + 100);
    if (error) throw error;
    return NextResponse.json({ labels: (data || []).slice(0, 100), hasMore: (data || []).length > 100 }, { headers });
  } catch {
    return NextResponse.json({ error: 'No se pudo cargar el historial. Vuelve a intentarlo.' }, { status: 500, headers });
  }
}

// expires_at controls exposure only. Product dates and traceability stay untouched.
export async function POST(request: Request) {
  try {
    const tenant = await tenantContextForRequest(request);
    if (!tenant.ok) return NextResponse.json({ error: tenant.error }, { status: tenant.status, headers });
    let input;
    try { input = await request.json(); } catch { return NextResponse.json({ error: 'Solicitud incorrecta.' }, { status: 400, headers }); }
    if (!input || typeof input.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id)) {
      return NextResponse.json({ error: 'Identificador incorrecto.' }, { status: 400, headers });
    }
    const now = Date.now();
    const until = input.duration === '24' || input.duration === '72'
      ? now + Number(input.duration) * 3600000
      : input.duration === 'date' && typeof input.until === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.until) ? Date.parse(input.until) : NaN;
    if (!Number.isFinite(until) || until <= now) return NextResponse.json({ error: 'Elige 24 horas, 72 horas o una fecha futura.' }, { status: 400, headers });
    const { data, error } = await supabaseAdmin.from('digital_tags')
      .update({ is_active: true, expires_at: new Date(until).toISOString() })
      .eq('company_id', tenant.context.companyId).eq('id', input.id)
      .in('source', ['invoice', 'physical_label']).is('annulled_at', null)
      .gte('created_at', new Date(now - 15 * 86400000).toISOString())
      .select(FIELDS).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'No se puede mostrar esta etiqueta: está anulada o fuera del historial de tu empresa.' }, { status: 404, headers });
    return NextResponse.json({ label: data }, { headers });
  } catch {
    return NextResponse.json({ error: 'No se pudo devolver la etiqueta al visor. Vuelve a intentarlo.' }, { status: 500, headers });
  }
}
