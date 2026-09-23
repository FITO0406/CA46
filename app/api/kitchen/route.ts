import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { tenantContextForRequest } from '@/lib/tenant-auth-server';
import { decodeTraceability, encodeTraceability, type TraceabilityData } from '@/lib/traceability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFINITIVE_HOURS = 72;

function clean(value: unknown, max = 220) {
  return String(value ?? '').trim().slice(0, max);
}

function numberOrZero(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function fallbackTrace(parent: any): TraceabilityData {
  return {
    establishment: '',
    description: String(parent.product_name || ''),
    lot: '',
    brand: '',
    netWeight: '',
    productionMethod: '',
    presentation: '',
    origin: String(parent.origin || ''),
    fao: '',
    freshness: '',
    fishingGear: '',
    ceCode: '',
    buyer: '',
    buyerNumber: '',
    extraFields: [],
  };
}

export async function GET(request: Request) {
  try {
    const access = await tenantContextForRequest(request);
    if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });

    const [tagsResult, transformationsResult] = await Promise.all([
      supabaseAdmin
        .from('digital_tags')
        .select('id, product_name, origin, category, source, status, created_at, expires_at, parent_tag_id')
        .eq('company_id', access.context.companyId)
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(200),
      supabaseAdmin
        .from('kitchen_transformations')
        .select('id, parent_tag_id, child_tag_id, process_type, processed_at, input_weight_kg, output_weight_kg, salt_grams, ingredients, nutrition_per_100g, output_product_name, output_lot, notes, created_at')
        .eq('company_id', access.context.companyId)
        .order('processed_at', { ascending: false })
        .limit(50),
    ]);

    if (tagsResult.error) throw tagsResult.error;
    if (transformationsResult.error) throw transformationsResult.error;

    return NextResponse.json({ ok: true, tags: tagsResult.data || [], transformations: transformationsResult.data || [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('kitchen GET error:', error);
    return NextResponse.json({ ok: false, error: 'No se pudo cargar Cocina.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const access = await tenantContextForRequest(request);
    if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });

    const body = await request.json().catch(() => ({}));
    const parentTagId = clean(body?.parentTagId, 80);
    const processType = clean(body?.processType, 120);
    const outputProductName = clean(body?.outputProductName, 180);
    const outputLotInput = clean(body?.outputLot, 120);
    const inputWeightKg = Number(body?.inputWeightKg);
    const outputWeightKg = Number(body?.outputWeightKg);
    const saltGrams = numberOrZero(body?.saltGrams);
    const notes = clean(body?.notes, 1000);
    const processedAt = body?.processedAt ? new Date(body.processedAt) : new Date();

    if (!parentTagId || !processType || !outputProductName || !Number.isFinite(inputWeightKg) || inputWeightKg <= 0 || !Number.isFinite(outputWeightKg) || outputWeightKg <= 0 || Number.isNaN(processedAt.getTime())) {
      return NextResponse.json({ ok: false, error: 'Producto origen, proceso, producto final y pesos son obligatorios.' }, { status: 400 });
    }

    const { data: parent, error: parentError } = await supabaseAdmin
      .from('digital_tags')
      .select('id, product_name, origin, category, company_id')
      .eq('id', parentTagId)
      .eq('company_id', access.context.companyId)
      .maybeSingle();
    if (parentError) throw parentError;
    if (!parent) return NextResponse.json({ ok: false, error: 'La etiqueta origen no pertenece a tu empresa o ya no existe.' }, { status: 404 });

    const ingredientsRaw = Array.isArray(body?.ingredients) ? body.ingredients : [];
    const ingredients = ingredientsRaw
      .map((item: any) => ({ name: clean(item?.name, 120), quantity: clean(item?.quantity, 80) }))
      .filter((item: any) => item.name);

    const nutrition = {
      energyKcal: numberOrZero(body?.nutrition?.energyKcal),
      proteinG: numberOrZero(body?.nutrition?.proteinG),
      carbsG: numberOrZero(body?.nutrition?.carbsG),
      sugarsG: numberOrZero(body?.nutrition?.sugarsG),
      fatG: numberOrZero(body?.nutrition?.fatG),
      saturatedFatG: numberOrZero(body?.nutrition?.saturatedFatG),
      saltG: numberOrZero(body?.nutrition?.saltG),
    };

    const parentTrace = decodeTraceability(parent.category) || fallbackTrace(parent);
    const dateCode = processedAt.toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
    const outputLot = outputLotInput || `${parentTrace.lot || 'LOTE'}-C${dateCode}`;
    const ingredientLabel = ingredients.map((item: any) => `${item.name}${item.quantity ? ` (${item.quantity})` : ''}`).join(', ');

    const childTrace: TraceabilityData = {
      ...parentTrace,
      description: outputProductName,
      lot: outputLot,
      netWeight: String(outputWeightKg),
      presentation: processType,
      extraFields: [
        ...(parentTrace.extraFields || []),
        { label: 'Transformación', value: processType },
        { label: 'Lote de origen', value: parentTrace.lot || parent.id },
        { label: 'Peso antes de cocinar', value: `${inputWeightKg} kg` },
        { label: 'Peso final cocinado', value: `${outputWeightKg} kg` },
        ...(saltGrams > 0 ? [{ label: 'Sal / salmuera', value: `${saltGrams} g de sal` }] : []),
        ...(ingredientLabel ? [{ label: 'Ingredientes / aditivos', value: ingredientLabel }] : []),
        { label: 'Valor energético', value: `${nutrition.energyKcal} kcal / 100 g` },
        { label: 'Proteínas', value: `${nutrition.proteinG} g / 100 g` },
        { label: 'Hidratos de carbono', value: `${nutrition.carbsG} g / 100 g` },
        { label: 'Azúcares', value: `${nutrition.sugarsG} g / 100 g` },
        { label: 'Grasas', value: `${nutrition.fatG} g / 100 g` },
        { label: 'Grasas saturadas', value: `${nutrition.saturatedFatG} g / 100 g` },
        { label: 'Sal nutricional', value: `${nutrition.saltG} g / 100 g` },
      ],
    };

    const now = new Date();
    const expiresAt = new Date(now.getTime() + DEFINITIVE_HOURS * 60 * 60 * 1000);
    const { data: child, error: childError } = await supabaseAdmin
      .from('digital_tags')
      .insert({
        company_id: access.context.companyId,
        created_by_user_id: access.context.userId,
        parent_tag_id: parent.id,
        source: 'kitchen',
        status: 'definitive',
        drive_file_id: `kitchen-${randomUUID()}`,
        product_name: outputProductName,
        price: 0,
        unit: 'kg',
        origin: parent.origin || parentTrace.origin || null,
        category: encodeTraceability(childTrace),
        is_active: true,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select('id, product_name, category, expires_at')
      .single();
    if (childError) throw childError;

    const { data: transformation, error: transformationError } = await supabaseAdmin
      .from('kitchen_transformations')
      .insert({
        company_id: access.context.companyId,
        parent_tag_id: parent.id,
        child_tag_id: child.id,
        process_type: processType,
        processed_at: processedAt.toISOString(),
        input_weight_kg: inputWeightKg,
        output_weight_kg: outputWeightKg,
        salt_grams: saltGrams,
        ingredients,
        nutrition_per_100g: nutrition,
        output_product_name: outputProductName,
        output_lot: outputLot,
        notes: notes || null,
        created_by_user_id: access.context.userId,
      })
      .select('*')
      .single();

    if (transformationError) {
      await supabaseAdmin.from('digital_tags').delete().eq('id', child.id).eq('company_id', access.context.companyId);
      throw transformationError;
    }

    return NextResponse.json({ ok: true, child, transformation }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('kitchen POST error:', error);
    return NextResponse.json({ ok: false, error: 'No se pudo guardar la transformación.' }, { status: 500 });
  }
}
