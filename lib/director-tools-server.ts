import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { stripePublicStatus } from '@/lib/stripe-server';

export type DirectorSnapshot = {
  checkedAt: string;
  companies: { total: number; active: number; trial: number; suspended: number; cancelled: number; recent: Array<{ name: string; status: string; plan: string; createdAt: string }> };
  operations: { activeMembers: number; activeTags: number; equipment: number; readings24h: number; temperatureAlerts24h: number; kitchenTransformations24h: number };
  billing: { subscriptions: number; unpaid: number; pending: number; invoices: number; failedInvoiceEmails: number; stripeReady: boolean };
  incidents: Array<{ severity: 'critical' | 'important' | 'improvement'; title: string; detail: string }>;
};

async function rows(table: string, select = '*') {
  const result = await supabaseAdmin.from(table).select(select);
  if (result.error) throw result.error;
  return result.data || [];
}

export async function collectDirectorSnapshot(): Promise<DirectorSnapshot> {
  const now = Date.now();
  const since24h = new Date(now - 86400000).toISOString();
  const [companies, members, tags, subscriptions, invoices, equipment, temperatures, transformations] = await Promise.all([
    rows('companies', 'id,name,status,plan,created_at'),
    rows('company_members', 'company_id,is_active'),
    rows('digital_tags', 'id,is_active,expires_at'),
    rows('company_subscriptions', 'company_id,status'),
    rows('service_invoices', 'id,email_status'),
    rows('temperature_equipment', 'id,is_active'),
    supabaseAdmin.from('temperature_readings').select('id,within_limits').gte('measured_at', since24h),
    supabaseAdmin.from('kitchen_transformations').select('id').gte('created_at', since24h),
  ]);
  if (temperatures.error) throw temperatures.error;
  if (transformations.error) throw transformations.error;

  const activeCompanies = companies.filter((x: any) => x.status === 'active').length;
  const trialCompanies = companies.filter((x: any) => x.status === 'trial').length;
  const suspendedCompanies = companies.filter((x: any) => x.status === 'suspended').length;
  const activeMembers = members.filter((x: any) => x.is_active).length;
  const activeCompanyIds = new Set(companies.filter((x: any) => ['active', 'trial'].includes(x.status)).map((x: any) => x.id));
  const companyIdsWithMember = new Set(members.filter((x: any) => x.is_active).map((x: any) => x.company_id));
  const missingMembers = [...activeCompanyIds].filter((id) => !companyIdsWithMember.has(id)).length;
  const tempAlerts = (temperatures.data || []).filter((x: any) => x.within_limits === false).length;
  const failedEmails = invoices.filter((x: any) => x.email_status === 'failed').length;
  const stripe = stripePublicStatus();
  const incidents: DirectorSnapshot['incidents'] = [];

  if (missingMembers) incidents.push({ severity: 'critical', title: 'Empresas sin usuario activo', detail: `${missingMembers} empresa(s) operativa(s) no tienen usuario activo.` });
  if (tempAlerts) incidents.push({ severity: 'critical', title: 'Temperaturas fuera de rango', detail: `${tempAlerts} lectura(s) fuera de límites en las últimas 24 horas.` });
  if (subscriptions.some((x: any) => x.status === 'unpaid')) incidents.push({ severity: 'critical', title: 'Suscripciones impagadas', detail: 'Existen cobros impagados que requieren revisión.' });
  if (failedEmails) incidents.push({ severity: 'important', title: 'Facturas no enviadas', detail: `${failedEmails} factura(s) tienen error de envío.` });
  if (!stripe.ready) incidents.push({ severity: 'important', title: 'Stripe pendiente', detail: 'El sistema de cobro todavía no está completamente configurado.' });
  if (!companies.length) incidents.push({ severity: 'improvement', title: 'Sin empresas piloto', detail: 'Todavía no hay empresas creadas en el modelo multiempresa activo.' });

  return {
    checkedAt: new Date().toISOString(),
    companies: {
      total: companies.length,
      active: activeCompanies,
      trial: trialCompanies,
      suspended: suspendedCompanies,
      cancelled: companies.filter((x: any) => x.status === 'cancelled').length,
      recent: companies.sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 8).map((x: any) => ({ name: x.name, status: x.status, plan: x.plan, createdAt: x.created_at })),
    },
    operations: {
      activeMembers,
      activeTags: tags.filter((x: any) => x.is_active && (!x.expires_at || new Date(x.expires_at).getTime() > now)).length,
      equipment: equipment.filter((x: any) => x.is_active).length,
      readings24h: (temperatures.data || []).length,
      temperatureAlerts24h: tempAlerts,
      kitchenTransformations24h: (transformations.data || []).length,
    },
    billing: {
      subscriptions: subscriptions.length,
      unpaid: subscriptions.filter((x: any) => x.status === 'unpaid').length,
      pending: subscriptions.filter((x: any) => x.status === 'pending').length,
      invoices: invoices.length,
      failedInvoiceEmails: failedEmails,
      stripeReady: stripe.ready,
    },
    incidents,
  };
}

export function deterministicBriefing(snapshot: DirectorSnapshot, since: string | null) {
  const sections = {
    critical: snapshot.incidents.filter((x) => x.severity === 'critical'),
    important: snapshot.incidents.filter((x) => x.severity === 'important'),
    improvement: snapshot.incidents.filter((x) => x.severity === 'improvement'),
  };
  const lines = [
    `Reunión diaria de DIRECTOR CA46 · ${new Date(snapshot.checkedAt).toLocaleString('es-ES')}`,
    `Periodo revisado: ${since ? `desde ${new Date(since).toLocaleString('es-ES')}` : 'primera reunión registrada'}.`,
    '',
    'CRÍTICO',
    ...(sections.critical.length ? sections.critical.map((x) => `• ${x.title}: ${x.detail}`) : ['• Sin incidencias críticas detectadas por las fuentes conectadas.']),
    '',
    'IMPORTANTE',
    ...(sections.important.length ? sections.important.map((x) => `• ${x.title}: ${x.detail}`) : ['• Sin avisos importantes detectados.']),
    `• Empresas: ${snapshot.companies.total} totales; ${snapshot.companies.active} activas; ${snapshot.companies.trial} en prueba; ${snapshot.companies.suspended} suspendidas.`,
    `• Operaciones: ${snapshot.operations.activeMembers} usuarios activos, ${snapshot.operations.activeTags} etiquetas activas y ${snapshot.operations.equipment} equipos de frío.`,
    '',
    'MEJORA',
    ...(sections.improvement.length ? sections.improvement.map((x) => `• ${x.title}: ${x.detail}`) : ['• Revisar semanalmente los procesos menos utilizados y los errores repetidos.']),
    '',
    'OPORTUNIDAD',
    `• Incorporar empresas piloto y medir activación, uso de etiquetas, cocina y temperaturas.`,
    '',
    'PRIORIDADES RECOMENDADAS',
    '1. Resolver cualquier elemento crítico antes de cambios de producto.',
    '2. Revisar configuración de cobros e integraciones pendientes.',
    '3. Activar una primera empresa piloto y validar el recorrido completo.',
  ];
  return lines.join('\n');
}

export const DIRECTOR_TOOL_NAMES = ['consultar_estado_sistema', 'consultar_empresas', 'consultar_incidencias', 'consultar_metricas', 'preparar_accion_autorizada'] as const;
