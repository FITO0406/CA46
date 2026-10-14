import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { tenantContextForRequest } from '@/lib/tenant-auth-server';
import { decodeTraceability, encodeTraceability, type TraceabilityData } from '@/lib/traceability';
import { calculateKitchenNutrition, inheritedKitchenFields, KITCHEN_DISPLAY_DAYS, manualNutrition, numberValue, nutritionExtraFields, nutritionFromParent } from '@/lib/kitchen-nutrition';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
        .select('id, parent_tag_id, child_tag_id, process_type, processed_at, input_weight_kg, output_weight_kg, salt_grams, ingredients, nutrition_per_100g, output_product_name, output_lot, storage_max_temp_c, shelf_life_days, storage_instructions, notes, created_at')
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
    const incorporatedSaltGrams = numberValue(body?.incorporatedSaltGrams ?? 0);
    if (incorporatedSaltGrams === null) return NextResponse.json({ ok: false, error: 'Indica una cantidad válida de sal incorporada en gramos.' }, { status: 422 });
    const storageMaxTempC = Number(body?.storageMaxTempC);
    const shelfLifeDays = Number(body?.shelfLifeDays);
    const storageInstructions = clean(body?.storageInstructions, 240);
    const notes = clean(body?.notes, 1000);
    const processedAt = body?.processedAt ? new Date(body.processedAt) : new Date();

    if (!parentTagId || !processType || !outputProductName || !Number.isFinite(inputWeightKg) || inputWeightKg <= 0 || !Number.isFinite(outputWeightKg) || outputWeightKg <= 0 || !Number.isFinite(storageMaxTempC) || storageMaxTempC < -40 || storageMaxTempC > 30 || !Number.isInteger(shelfLifeDays) || shelfLifeDays < 1 || shelfLifeDays > 365 || Number.isNaN(processedAt.getTime())) {
      return NextResponse.json({ ok: false, error: 'Producto origen, proceso, pesos, temperatura de conservación y vida útil son obligatorios.' }, { status: 400 });
    }

    const { data: parent, error: parentError } = await supabaseAdmin
      .from('digital_tags')
      .select('id, product_name, origin, category, company_id, source, status, is_active, expires_at')
      .eq('id', parentTagId)
      .eq('company_id', access.context.companyId)
      .maybeSingle();
    if (parentError) throw parentError;
    if (!parent) return NextResponse.json({ ok: false, error: 'La etiqueta origen no pertenece a tu empresa o ya no existe.' }, { status: 404 });

    const parentExpiresAt = new Date(parent.expires_at).getTime();
    if (!parent.is_active || !Number.isFinite(parentExpiresAt) || parentExpiresAt <= processedAt.getTime()) {
      return NextResponse.json({ ok: false, error: 'La etiqueta origen ya no está activa y no puede generar nuevas etiquetas hijas.' }, { status: 409 });
    }

    const temporaryChain = parent.status === 'provisional' && (parent.source === 'physical_label' || parent.source === 'kitchen');

    const ingredientsRaw = Array.isArray(body?.ingredients) ? body.ingredients : [];
    const ingredients = ingredientsRaw
      .map((item: any) => ({ name: clean(item?.name, 120), quantity: clean(item?.quantity, 80) }))
      .filter((item: any) => item.name);

    const parentTrace = decodeTraceability(parent.category) || fallbackTrace(parent);
    const parentConsumptionDate = parentTrace.extraFields.find((field) => field.label === 'Fecha límite de consumo')?.value;
    if (parentConsumptionDate && new Date(parentConsumptionDate).getTime() <= processedAt.getTime()) {
      return NextResponse.json({ ok: false, error: 'El lote de origen ha superado su plazo de consumo. Su presencia en el visor no amplía ese plazo.' }, { status: 409 });
    }
    const calculation = calculateKitchenNutrition({
      productName: `${parent.product_name} ${parentTrace.scientificName || ''}`,
      referenceId: clean(body?.nutritionReferenceId, 20),
      parentNutrition: parent.source === 'kitchen' ? nutritionFromParent(parentTrace.extraFields) : null,
      inputWeightKg, outputWeightKg, processType, ingredients,
      incorporatedSaltGrams,
    });
    const manual = body?.nutritionMode === 'manual';
    const nutrition = manual ? manualNutrition(body?.nutrition || {}) : calculation.values;
    if (manual && !nutrition) {
      return NextResponse.json({ ok: false, error: 'Completa los siete valores nutricionales manuales con cantidades válidas por 100 g. Los campos vacíos no equivalen a cero.' }, { status: 422 });
    }
    const nutritionMethod = manual ? 'Valores manuales del producto terminado · revisar fuente' : calculation.method;
    const nutritionSources = manual ? ['Datos introducidos por la empresa'] : calculation.sources;
    const nutritionWarnings = manual ? [] : calculation.warnings;
    const dateCode = processedAt.toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
    const outputLot = outputLotInput || `${parentTrace.lot || 'LOTE'}-C${dateCode}`;
    const ingredientLabel = ingredients.map((item: any) => `${item.name}${item.quantity ? ` (${item.quantity})` : ''}`).join(', ');

    const childTrace: TraceabilityData = {
      ...parentTrace,
      description: outputProductName,
      lot: outputLot,
      netWeight: String(outputWeightKg),
      presentation: processType,
      consumerNotice: `Consumir preferentemente antes de ${shelfLifeDays} días desde la elaboración. ${storageInstructions || `Conservar a ≤ ${storageMaxTempC} °C`}`,
      extraFields: [
        ...inheritedKitchenFields(parentTrace.extraFields || []),
        { label: 'Transformación', value: processType },
        { label: 'Lote de origen', value: parentTrace.lot || parent.id },
        ...(temporaryChain ? [
          { label: 'Cadena CA46', value: 'Hija de etiqueta temporal · 10 días en visor' },
          { label: 'Origen provisional', value: 'Etiqueta física de caja · factura pendiente' },
        ] : []),
        { label: 'Peso antes de cocinar', value: `${inputWeightKg} kg` },
        { label: 'Peso final cocinado', value: `${outputWeightKg} kg` },
        { label: 'Conservación', value: storageInstructions || `Conservar a ≤ ${storageMaxTempC} °C` },
        { label: 'Consumo preferente', value: `Antes de ${shelfLifeDays} día${shelfLifeDays === 1 ? '' : 's'} desde la elaboración` },
        { label: 'Fecha límite de consumo', value: new Date(processedAt.getTime() + shelfLifeDays * 86400000).toISOString() },
        { label: 'Exposición en visor', value: `${KITCHEN_DISPLAY_DAYS} días desde la elaboración; independiente del plazo de consumo` },
        ...(saltGrams > 0 ? [{ label: 'Sal / salmuera', value: `${saltGrams} g de sal` }] : []),
        ...(ingredientLabel ? [{ label: 'Ingredientes / aditivos', value: ingredientLabel }] : []),
        ...(incorporatedSaltGrams > 0 ? [{ label: 'Sal incorporada', value: `${incorporatedSaltGrams} g` }] : []),
        ...nutritionExtraFields(nutrition, nutritionMethod, nutritionSources, nutritionWarnings),
      ],
    };

    const now = new Date();
    const expiresAt = new Date(processedAt.getTime() + KITCHEN_DISPLAY_DAYS * 86400000);
    const { data: child, error: childError } = await supabaseAdmin
      .from('digital_tags')
      .insert({
        company_id: access.context.companyId,
        created_by_user_id: access.context.userId,
        parent_tag_id: parent.id,
        source: 'kitchen',
        status: temporaryChain ? 'provisional' : 'definitive',
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
      .select('id, product_name, category, expires_at, source, status, parent_tag_id')
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
        nutrition_per_100g: { ...(nutrition || {}), status: nutrition ? 'calculated' : 'pending', method: nutritionMethod, sources: nutritionSources, warnings: nutritionWarnings },
        output_product_name: outputProductName,
        output_lot: outputLot,
        storage_max_temp_c: storageMaxTempC,
        shelf_life_days: shelfLifeDays,
        storage_instructions: storageInstructions || `Conservar a ≤ ${storageMaxTempC} °C`,
        notes: notes || null,
        created_by_user_id: access.context.userId,
      })
      .select('*')
      .single();

    if (transformationError) {
      await supabaseAdmin.from('digital_tags').delete().eq('id', child.id).eq('company_id', access.context.companyId);
      throw transformationError;
    }

    return NextResponse.json({
      ok: true,
      child,
      transformation,
      temporary_chain: temporaryChain,
      valid_hours: KITCHEN_DISPLAY_DAYS * 24,
      nutrition_status: nutrition ? 'calculated' : 'pending',
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('kitchen POST error:', error);
    return NextResponse.json({ ok: false, error: 'No se pudo guardar la transformación.' }, { status: 500 });
  }
}
