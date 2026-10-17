import { supabaseAdmin } from '@/lib/supabase';

// Explicit portable operational fields. Credentials, screen tokens and internal notes
// are intentionally not selected, including if future columns are added to a table.
export const EXPORT_TABLES: { table: string; scope: string; order: string; fields: string }[] = [
  { table: 'companies', scope: 'id', order: 'id', fields: 'id,name,slug,plan,status,created_at,updated_at' },
  { table: 'company_settings', scope: 'company_id', order: 'company_id', fields: 'company_id,business_name,legal_name,tax_id,phone,email,address,postal_code,city,province,contact_first_name,contact_last_name,contact_phone,contact_email,labels_hours,screen_name,drive_folder_url' },
  { table: 'company_members', scope: 'company_id', order: 'user_id', fields: 'company_id,user_id,role,is_active,created_at,updated_at' },
  { table: 'digital_tags', scope: 'company_id', order: 'id', fields: 'id,company_id,drive_file_id,product_name,price,unit,origin,category,is_active,created_at,expires_at,source,status,created_by_user_id,parent_tag_id,annulled_at,annulled_reason,annulled_note,annulled_by_user_id' },
  { table: 'kitchen_transformations', scope: 'company_id', order: 'id', fields: 'id,company_id,parent_tag_id,child_tag_id,process_type,processed_at,input_weight_kg,output_weight_kg,salt_grams,ingredients,nutrition_per_100g,output_product_name,output_lot,notes,created_by_user_id,created_at,storage_max_temp_c,shelf_life_days,storage_instructions' },
  { table: 'temperature_equipment', scope: 'company_id', order: 'id', fields: 'id,company_id,name,equipment_type,min_temp_c,max_temp_c,is_active,created_at,updated_at' },
  { table: 'temperature_readings', scope: 'company_id', order: 'id', fields: 'id,company_id,equipment_id,measured_at,temperature_c,min_temp_c_snapshot,max_temp_c_snapshot,within_limits,corrective_action,notes,created_at' },
  { table: 'company_drive_archives', scope: 'company_id', order: 'tag_id,root_folder_id', fields: 'company_id,tag_id,root_folder_id,file_id,archived_at' },
];
export class ExportTooLarge extends Error {}
export async function exportCompany(companyId: string) {
  const startedAt = new Date().toISOString();
  const tables: Record<string, Record<string, unknown>[]> = {};
  let bytes = 0;
  for (const definition of EXPORT_TABLES) {
    const rows: Record<string, unknown>[] = [];
    let lastRow: Record<string, unknown> | undefined;
    // Bounded to protect server memory. Never silently truncate a delivered export.
    for (let page = 0; ; page++) {
      let query = supabaseAdmin.from(definition.table).select(definition.fields).eq(definition.scope, companyId);
      for (const column of definition.order.split(',')) query = query.order(column, { ascending: true });
      const { data, error } = await query.range(page * 500, page * 500 + 499);
      if (error) throw error;
      const batch = (data || []) as unknown as Record<string, unknown>[];
      bytes += Buffer.byteLength(JSON.stringify(batch), 'utf8');
      if (bytes > 15_000_000 || rows.length + batch.length > 25000) throw new ExportTooLarge();
      // A changing database is not an atomic snapshot; expose that limitation.
      if (lastRow && batch[0] && JSON.stringify(lastRow) === JSON.stringify(batch[0])) throw new Error('EXPORT_PAGINATION_FAILED');
      rows.push(...batch);
      lastRow = batch.at(-1);
      if (batch.length < 500) break;
    }
    tables[definition.table] = rows;
  }
  return { format: 'ca46-operational-export-v1', companyId, startedAt, completedAt: new Date().toISOString(),
    limitations: ['Lectura paginada, no instantánea transaccional.', 'No es una copia de seguridad íntegra.',
      'No incluye originales de Drive, credenciales, facturas, conversaciones IA, trabajos OCR.',
      'Para la devolución completa, solicita una exportación asistida en Datos y solicitudes.'], tables };
}
