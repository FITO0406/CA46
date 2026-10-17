import { NextResponse } from 'next/server';
import { contractSnapshot, companyContractParty, partyChecksum } from '@/lib/legal-contract-server';
import { serviceContext } from '@/lib/service-auth-server';
import { supabaseAdmin } from '@/lib/supabase';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  try {
    const ctx = await serviceContext(request);
    if (!ctx) return NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401, headers });
    const current = contractSnapshot();
    const party = ctx.companyId ? await companyContractParty(ctx.companyId) : null;
    let accepted = false;
    if (ctx.companyId && party) {
      const { data, error } = await supabaseAdmin.from('legal_acceptances').select('id')
        .eq('company_id', ctx.companyId).eq('version', current.version).eq('checksum', current.checksum).eq('party_checksum', partyChecksum(party)).limit(1).maybeSingle();
      if (error) throw error;
      accepted = Boolean(data);
    }
    return NextResponse.json({ ...current, snapshot: undefined, accepted, company: ctx.isAdmin ? party : null, canAccept: ctx.isAdmin && ctx.confirmed && Boolean(party) }, { headers });
  } catch {
    return NextResponse.json({ error: 'No se pudo consultar el contrato. Contacta con soporte.' }, { status: 503, headers });
  }
}
export async function POST(request: Request) {
  try {
    const ctx = await serviceContext(request);
    if (!ctx) return NextResponse.json({ error: 'No autorizado.' }, { status: 401, headers });
    if (!ctx.isAdmin || !ctx.companyId || !ctx.confirmed) return NextResponse.json({ error: 'Debe aceptar el administrador de la empresa con su correo confirmado.' }, { status: 403, headers });
    const current = contractSnapshot();
    if (!current.ready) return NextResponse.json({ error: 'La documentación está pendiente de aprobación. No puede aceptarse todavía.' }, { status: 503, headers });
    const body = await request.json();
    if (body.version !== current.version || body.checksum !== current.checksum) return NextResponse.json({ error: 'El documento ha cambiado. Recarga y revísalo.' }, { status: 409, headers });
    if (body.terms !== true || body.processing !== true || body.representative !== true) return NextResponse.json({ error: 'Revisa y acepta las condiciones y el encargo como representante autorizado.' }, { status: 400, headers });
    const party = await companyContractParty(ctx.companyId);
    if (!party) return NextResponse.json({ error: 'Completa la razón social, NIF y domicilio de tu empresa antes de aceptar el contrato.' }, { status: 409, headers });
    const { error } = await supabaseAdmin.from('legal_acceptances').insert({ company_id: ctx.companyId, user_id: ctx.userId,
      version: current.version, checksum: current.checksum, party_checksum: partyChecksum(party), document_snapshot: JSON.parse(current.snapshot), company_snapshot: party, representative_email: ctx.email });
    if (error && error.code !== '23505') throw error;
    return NextResponse.json({ ok: true, message: 'Aceptación registrada. Conserva una copia de los documentos.' }, { headers });
  } catch {
    return NextResponse.json({ error: 'No se pudo registrar la aceptación. Vuelve a intentarlo o contacta con soporte.' }, { status: 503, headers });
  }
}
