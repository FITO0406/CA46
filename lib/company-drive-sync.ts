import { archiveCompanyLabels } from '@/lib/company-drive-archive';

// Drive is an outward-only private archive. It never republishes old files.
export async function syncCompanyDrive({ companyId }: { companyId: string; userId?: string | null; force?: boolean }) {
  const result = await archiveCompanyLabels(companyId);
  return {
    ok: !result.error, configured: result.connected, throttled: Boolean(result.busy),
    found: result.archived + result.pending, imported: 0, skipped: 0, expired: 0,
    archived: result.archived, removed: result.removed || 0,
    errors: result.error ? [result.error] : [], syncedAt: new Date().toISOString(),
  };
}
