import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { superAdminContextForRequest } from '@/lib/superadmin-auth-server';
import { getCompanyAccessOverride } from '@/lib/company-access-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ companyId: string }> };

const allowedPlans = new Set(['gratis', 'autonomo', 'empresa', 'personalizado']);
const allowedStatuses = new Set(['active', 'trial', 'suspended', 'cancelled']);

export async function GET(request: Request, context: RouteContext) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const { companyId } = await context.params;
    if (!companyId) {
      return NextResponse.json(
        { ok: false, error: 'Empresa no válida.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id, name, slug, plan, status, owner_user_id, created_at, updated_at')
      .eq('id', companyId)
      .maybeSingle();

    if (companyError) throw companyError;
    if (!company) {
      return NextResponse.json(
        { ok: false, error: 'Empresa no encontrada.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const [settingsResult, membersResult, tagsResult, authUsersResult, accessGrant] = await Promise.all([
      supabaseAdmin
        .from('company_settings')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle(),
      supabaseAdmin
        .from('company_members')
        .select('user_id, role, is_active, created_at, updated_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('digital_tags')
        .select('id, product_name, origin, source, status, is_active, created_at, expires_at, created_by_user_id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      getCompanyAccessOverride(companyId),
    ]);

    if (settingsResult.error) throw settingsResult.error;
    if (membersResult.error) throw membersResult.error;
    if (tagsResult.error) throw tagsResult.error;

    const authUsers = new Map<string, { email: string; name: string }>();
    if (!authUsersResult.error) {
      for (const user of authUsersResult.data.users || []) {
        const metadata = user.user_metadata || {};
        const name = [metadata.first_name, metadata.last_name].filter(Boolean).join(' ').trim();
        authUsers.set(user.id, { email: user.email || '', name });
      }
    }

    const owner = authUsers.get(company.owner_user_id);
    const members = (membersResult.data || []).map((member) => {
      const authUser = authUsers.get(member.user_id);
      return {
        userId: member.user_id,
        email: authUser?.email || '',
        name: authUser?.name || '',
        role: member.role,
        active: Boolean(member.is_active),
        createdAt: member.created_at,
        updatedAt: member.updated_at,
      };
    });

    const now = Date.now();
    const tags = (tagsResult.data || []).map((tag) => ({
      id: tag.id,
      productName: tag.product_name || '',
      origin: tag.origin || '',
      source: tag.source,
      status: tag.status,
      active: Boolean(tag.is_active) && (!tag.expires_at || new Date(tag.expires_at).getTime() > now),
      createdAt: tag.created_at,
      expiresAt: tag.expires_at,
      createdByUserId: tag.created_by_user_id || '',
    }));

    const settings = settingsResult.data || null;

    return NextResponse.json(
      {
        ok: true,
        company: {
          id: company.id,
          name: company.name,
          slug: company.slug,
          plan: company.plan,
          status: company.status,
          ownerUserId: company.owner_user_id,
          ownerEmail: owner?.email || '',
          ownerName: owner?.name || '',
          createdAt: company.created_at,
          updatedAt: company.updated_at,
          accessGrant,
          effectivePlan: accessGrant?.effective ? accessGrant.plan : company.plan,
          settings: settings
            ? {
                businessName: settings.business_name || '',
                legalName: settings.legal_name || '',
                taxId: settings.tax_id || '',
                phone: settings.phone || '',
                email: settings.email || '',
                address: settings.address || '',
                postalCode: settings.postal_code || '',
                city: settings.city || '',
                province: settings.province || '',
                contactFirstName: settings.contact_first_name || '',
                contactLastName: settings.contact_last_name || '',
                contactPhone: settings.contact_phone || '',
                contactEmail: settings.contact_email || '',
                selectedBankIds: settings.selected_bank_ids || [],
                screenName: settings.screen_name || '',
                publicScreenEnabled: settings.public_screen_enabled !== false,
                publicScreenToken: settings.public_screen_token || '',
                driveConnected: Boolean(settings.drive_connected),
                driveFolderId: settings.drive_folder_id || '',
                driveFolderUrl: settings.drive_folder_url || '',
                driveLastSyncAt: settings.drive_last_sync_at || null,
              }
            : null,
          members,
          tags,
          summary: {
            members: members.filter((member) => member.active).length,
            activeTags: tags.filter((tag) => tag.active).length,
            totalTags: tags.length,
          },
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('superadmin/company detail error:', error);
    return NextResponse.json(
      { ok: false, error: 'No se pudo cargar la ficha de la empresa.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const { companyId } = await context.params;
    if (!companyId) {
      return NextResponse.json(
        { ok: false, error: 'Empresa no válida.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const body = await request.json().catch(() => ({}));
    const update: Record<string, string> = {};

    if (body?.plan !== undefined) {
      const plan = String(body.plan || '').trim().toLowerCase();
      if (!allowedPlans.has(plan)) {
        return NextResponse.json(
          { ok: false, error: 'Plan no válido.' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      update.plan = plan;
    }

    if (body?.status !== undefined) {
      const status = String(body.status || '').trim().toLowerCase();
      if (!allowedStatuses.has(status)) {
        return NextResponse.json(
          { ok: false, error: 'Estado no válido.' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      update.status = status;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No hay cambios válidos.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('companies')
      .select('id, plan, status')
      .eq('id', companyId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'Empresa no encontrada.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const { data: company, error: updateError } = await supabaseAdmin
      .from('companies')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('id', companyId)
      .select('id, plan, status, updated_at')
      .single();

    if (updateError) throw updateError;

    console.info('superadmin company control', {
      superAdminUserId: access.context.userId,
      superAdminEmail: access.context.email,
      companyId,
      previousPlan: existing.plan,
      previousStatus: existing.status,
      nextPlan: company.plan,
      nextStatus: company.status,
    });

    return NextResponse.json(
      {
        ok: true,
        company: {
          id: company.id,
          plan: company.plan,
          status: company.status,
          updatedAt: company.updated_at,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('superadmin/company control error:', error);
    return NextResponse.json(
      { ok: false, error: 'No se pudo actualizar la empresa.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
