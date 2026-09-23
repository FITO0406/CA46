import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { tenantContextForRequest } from '@/lib/tenant-auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

export async function GET(request: Request) {
  try {
    const access = await tenantContextForRequest(request);
    if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });

    const [equipmentResult, readingsResult] = await Promise.all([
      supabaseAdmin.from('temperature_equipment').select('*').eq('company_id', access.context.companyId).eq('is_active', true).order('name'),
      supabaseAdmin.from('temperature_readings').select('*, temperature_equipment(name, equipment_type)').eq('company_id', access.context.companyId).order('measured_at', { ascending: false }).limit(100),
    ]);
    if (equipmentResult.error) throw equipmentResult.error;
    if (readingsResult.error) throw readingsResult.error;
    return NextResponse.json({ ok: true, equipment: equipmentResult.data || [], readings: readingsResult.data || [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('temperatures GET error:', error);
    return NextResponse.json({ ok: false, error: 'No se pudo cargar el control de temperaturas.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const access = await tenantContextForRequest(request);
    if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    const body = await request.json().catch(() => ({}));

    if (body?.action === 'add_equipment') {
      const name = clean(body.name, 120);
      const equipmentType = clean(body.equipmentType, 30);
      const minTempC = Number(body.minTempC);
      const maxTempC = Number(body.maxTempC);
      if (!name || !['fresh_room', 'freezer', 'other'].includes(equipmentType) || !Number.isFinite(minTempC) || !Number.isFinite(maxTempC) || minTempC > maxTempC || minTempC < -60 || maxTempC > 40) {
        return NextResponse.json({ ok: false, error: 'Revisa el nombre, el tipo y los límites del equipo.' }, { status: 400 });
      }
      const { data, error } = await supabaseAdmin.from('temperature_equipment').insert({ company_id: access.context.companyId, name, equipment_type: equipmentType, min_temp_c: minTempC, max_temp_c: maxTempC, created_by_user_id: access.context.userId }).select('*').single();
      if (error) throw error;
      return NextResponse.json({ ok: true, equipment: data }, { status: 201 });
    }

    if (body?.action === 'add_reading') {
      const equipmentId = clean(body.equipmentId, 80);
      const temperatureC = Number(body.temperatureC);
      const notes = clean(body.notes);
      const correctiveAction = clean(body.correctiveAction, 1000);
      const measuredAt = body.measuredAt ? new Date(body.measuredAt) : new Date();
      if (!equipmentId || !Number.isFinite(temperatureC) || temperatureC < -80 || temperatureC > 80 || Number.isNaN(measuredAt.getTime())) {
        return NextResponse.json({ ok: false, error: 'Indica el equipo, la temperatura y una fecha válidos.' }, { status: 400 });
      }
      const { data: equipment, error: equipmentError } = await supabaseAdmin.from('temperature_equipment').select('*').eq('id', equipmentId).eq('company_id', access.context.companyId).eq('is_active', true).maybeSingle();
      if (equipmentError) throw equipmentError;
      if (!equipment) return NextResponse.json({ ok: false, error: 'El equipo no pertenece a tu empresa o está inactivo.' }, { status: 404 });
      const withinLimits = temperatureC >= Number(equipment.min_temp_c) && temperatureC <= Number(equipment.max_temp_c);
      if (!withinLimits && !correctiveAction) return NextResponse.json({ ok: false, error: 'La lectura está fuera de rango. Indica la medida correctora aplicada.' }, { status: 400 });

      const { data, error } = await supabaseAdmin.from('temperature_readings').insert({ company_id: access.context.companyId, equipment_id: equipment.id, measured_at: measuredAt.toISOString(), temperature_c: temperatureC, min_temp_c_snapshot: equipment.min_temp_c, max_temp_c_snapshot: equipment.max_temp_c, within_limits: withinLimits, corrective_action: correctiveAction || null, notes: notes || null, recorded_by_user_id: access.context.userId }).select('*').single();
      if (error) throw error;
      return NextResponse.json({ ok: true, reading: data }, { status: 201 });
    }

    return NextResponse.json({ ok: false, error: 'Acción no reconocida.' }, { status: 400 });
  } catch (error: unknown) {
    console.error('temperatures POST error:', error);
    const duplicate = typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
    return NextResponse.json({ ok: false, error: duplicate ? 'Ya existe un equipo activo con ese nombre.' : 'No se pudo guardar el control de temperatura.' }, { status: duplicate ? 409 : 500 });
  }
}
