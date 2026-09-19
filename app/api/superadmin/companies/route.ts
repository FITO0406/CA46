import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { superAdminContextForRequest } from '@/lib/superadmin-auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
};

type SettingsRow = {
  company_id: string;
  business_name: string;
  city: string;
  province: string;
  drive_connected: boolean;
  public_screen_enabled: boolean;
};

export async function GET(request: Request) {
  try {
    const access = await superAdminContextForRequest(request);
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const { data: companies, error: companiesError } = await supabaseAdmin
      .from('companies')
      .select('id, name, slug, plan, status, owner_user_id, created_at, updated_at')
      .order('created_at', { ascending: false })
      .returns<CompanyRow[]>();

    if (companiesError) throw companiesError;

    const companyIds = (companies || []).map((company) => company.id);
    if (companyIds.length === 0) {
      return NextResponse.json(
        { ok: true, companies: [], summary: { total: 0, active: 0, trial: 0, suspended: 0 } },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const [settingsResult, membersResult, tagsResult, authUsersResult] = await Promise.all([
      supabaseAdmin
        .from('company_settings')
        .select('company_id, business_name, city, province, drive_connected, public_screen_enabled')
        .in('company_id', companyIds)
        .returns<SettingsRow[]>(),
      supabaseAdmin
        .from('company_members')
        .select('company_id')
        .in('company_id', companyIds)
        .eq('is_active', true),
      supabaseAdmin
        .from('digital_tags')
        .select('company_id, expires_at')
        .in('company_id', companyIds)
        .eq('is_active', true),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    if (settingsResult.error) throw settingsResult.error;
    if (membersResult.error) throw membersResult.error;
    if (tagsResult.error) throw tagsResult.error;

    const settingsByCompany = new Map(
      (settingsResult.data || []).map((settings) => [settings.company_id, settings]),
    );

    const membersByCompany = new Map<string, number>();
    for (const member of membersResult.data || []) {
      if (!member.company_id) continue;
      membersByCompany.set(member.company_id, (membersByCompany.get(member.company_id) || 0) + 1);
    }

    const now = Date.now();
    const activeTagsByCompany = new Map<string, number>();
    for (const tag of tagsResult.data || []) {
      if (!tag.company_id) continue;
      const expiresAt = tag.expires_at ? new Date(tag.expires_at).getTime() : Number.POSITIVE_INFINITY;
      if (!Number.isFinite(expiresAt) || expiresAt > now) {
        activeTagsByCompany.set(tag.company_id, (activeTagsByCompany.get(tag.company_id) || 0) + 1);
      }
    }

    const ownerEmails = new Map<string, string>();
    if (!authUsersResult.error) {
      for (const user of authUsersResult.data.users || []) {
        ownerEmails.set(user.id, user.email || '');
      }
    }

    const payload = (companies || []).map((company) => {
      const settings = settingsByCompany.get(company.id);
      return {
        id: company.id,
        name: settings?.business_name?.trim() || company.name,
        registeredName: company.name,
        slug: company.slug,
        plan: company.plan,
        status: company.status,
        ownerEmail: ownerEmails.get(company.owner_user_id) || '',
        city: settings?.city || '',
        province: settings?.province || '',
        driveConnected: Boolean(settings?.drive_connected),
        publicScreenEnabled: settings?.public_screen_enabled !== false,
        membersCount: membersByCompany.get(company.id) || 0,
        activeTagsCount: activeTagsByCompany.get(company.id) || 0,
        createdAt: company.created_at,
        updatedAt: company.updated_at,
      };
    });

    const summary = {
      total: payload.length,
      active: payload.filter((company) => company.status === 'active').length,
      trial: payload.filter((company) => company.status === 'trial').length,
      suspended: payload.filter((company) => company.status === 'suspended').length,
    };

    return NextResponse.json(
      { ok: true, companies: payload, summary },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('superadmin/companies error:', error);
    return NextResponse.json(
      { ok: false, error: 'No se pudo cargar el listado de empresas.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
