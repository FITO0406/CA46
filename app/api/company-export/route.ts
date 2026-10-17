import { NextResponse } from 'next/server';
import { serviceContext } from '@/lib/service-auth-server';
import { exportCompany, ExportTooLarge } from '@/lib/company-export-server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  try {
    const ctx = await serviceContext(request);
    if (!ctx) return NextResponse.json({ error: 'No autorizado.' }, { status: 401, headers });
    if (!ctx.isAdmin || !ctx.companyId || !ctx.confirmed) return NextResponse.json({ error: 'Solo el administrador confirmado puede exportar datos de empresa.' }, { status: 403, headers });
    const payload = await exportCompany(ctx.companyId);
    return NextResponse.json(payload, { headers: { ...headers, 'Content-Disposition': 'attachment; filename="ca46-datos-operativos.json"' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ExportTooLarge ? 'La descarga supera el límite. Solicita una exportación asistida.' : 'No se pudo exportar. No se ha entregado una descarga parcial; solicita una exportación asistida.' }, { status: error instanceof ExportTooLarge ? 413 : 503, headers });
  }
}
