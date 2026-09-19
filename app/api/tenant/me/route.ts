import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PlanId = 'gratis' | 'autonomo' | 'empresa' | 'personalizado';

const VALID_PLANS = new Set<PlanId>(['gratis', 'autonomo', 'empresa', 'personalizado']);

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function cleanPlan(value: unknown): PlanId {
  const candidate = String(value || '').toLowerCase() as PlanId;
  return VALID_PLANS.has(candidate) ? candidate : 'gratis';
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'empresa';
}

function schemaUnavailable(message = '') {
  return /relation .*companies.* does not exist|relation .*company_members.* does not exist|could not find the table .*companies|could not find the table .*company_members/i.test(message);
}

async function authenticatedUser(request: Request) {
  const token = bearerToken(request);
  if (!token) return { token: '', user: null, error: 'UNAUTHORIZED' as const };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { token, user: null, error: 'UNAUTHORIZED' as const };
  return { token, user: data.user, error: null };
}

async function readTenant(userId: string) {
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_members')
    .select('company_id, role, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (membershipError) return { tenant: null, error: membershipError };
  if (!membership) return { tenant: null, error: null };

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('id, name, slug, plan, status, created_at, updated_at')
    .eq('id', membership.company_id)
    .single();

  if (companyError) return { tenant: null, error: companyError };

  return {
    tenant: {
      company,
      membership: {
        role: membership.role,
        isActive: membership.is_active,
      },
    },
    error: null,
  };
}

export async function GET(request: Request) {
  const auth = await authenticatedUser(request);
  if (!auth.user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const result = await readTenant(auth.user.id);
  if (result.error) {
    const code = schemaUnavailable(result.error.message) ? 'MULTITENANT_SCHEMA_NOT_APPLIED' : 'TENANT_READ_FAILED';
    return NextResponse.json({ error: 'No se pudo consultar la empresa.', code }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.json(
    { ok: true, userId: auth.user.id, tenant: result.tenant },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  const auth = await authenticatedUser(request);
  if (!auth.user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const existing = await readTenant(auth.user.id);
  if (existing.error) {
    const code = schemaUnavailable(existing.error.message) ? 'MULTITENANT_SCHEMA_NOT_APPLIED' : 'TENANT_READ_FAILED';
    return NextResponse.json({ error: 'No se pudo consultar la empresa.', code }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  if (existing.tenant) {
    return NextResponse.json({ ok: true, created: false, tenant: existing.tenant }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const body = await request.json().catch(() => ({}));
  const metadata = auth.user.user_metadata || {};
  const companyName = String(body?.companyName || metadata.company_name || '').trim();
  if (!companyName) {
    return NextResponse.json(
      { error: 'Escribe el nombre comercial antes de crear la empresa.', code: 'COMPANY_NAME_REQUIRED' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const plan = cleanPlan(body?.plan || metadata.plan);

  const { data: ownedCompany, error: ownedError } = await supabaseAdmin
    .from('companies')
    .select('id, name, slug, plan, status, created_at, updated_at')
    .eq('owner_user_id', auth.user.id)
    .limit(1)
    .maybeSingle();

  if (ownedError) {
    const code = schemaUnavailable(ownedError.message) ? 'MULTITENANT_SCHEMA_NOT_APPLIED' : 'TENANT_CREATE_FAILED';
    return NextResponse.json({ error: 'No se pudo preparar la empresa.', code }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  let company = ownedCompany;
  let created = false;

  if (!company) {
    const slug = `${slugify(companyName)}-${auth.user.id.replace(/-/g, '').slice(0, 8)}`;
    const { data: createdCompany, error: createError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: companyName,
        slug,
        plan,
        status: 'active',
        owner_user_id: auth.user.id,
      })
      .select('id, name, slug, plan, status, created_at, updated_at')
      .single();

    if (createError || !createdCompany) {
      const code = schemaUnavailable(createError?.message || '') ? 'MULTITENANT_SCHEMA_NOT_APPLIED' : 'TENANT_CREATE_FAILED';
      return NextResponse.json({ error: 'No se pudo crear la empresa.', code }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    company = createdCompany;
    created = true;
  }

  const { error: memberError } = await supabaseAdmin
    .from('company_members')
    .upsert(
      {
        company_id: company.id,
        user_id: auth.user.id,
        role: 'admin_empresa',
        is_active: true,
      },
      { onConflict: 'company_id,user_id' },
    );

  if (memberError) {
    const code = schemaUnavailable(memberError.message) ? 'MULTITENANT_SCHEMA_NOT_APPLIED' : 'TENANT_MEMBER_FAILED';
    return NextResponse.json({ error: 'La empresa existe, pero no se pudo asignar el administrador.', code }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.json(
    {
      ok: true,
      created,
      tenant: {
        company,
        membership: { role: 'admin_empresa', isActive: true },
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
