import { createHash } from 'node:crypto';
import { legalDocuments, legalProfile, LEGAL_VERSION } from '@/lib/legal-documents';
import { supabaseAdmin } from '@/lib/supabase';

export function contractSnapshot() {
  const documents = legalDocuments();
  const snapshot = JSON.stringify({ version: LEGAL_VERSION, documents });
  return { version: LEGAL_VERSION, documents, snapshot, checksum: createHash('sha256').update(snapshot).digest('hex'), ready: legalProfile().ready };
}
export async function companyContractParty(companyId: string) {
  const { data, error } = await supabaseAdmin.from('company_settings')
    .select('legal_name,tax_id,address,postal_code,city,province,contact_email').eq('company_id', companyId).maybeSingle();
  if (error) throw error;
  return data?.legal_name?.trim() && data?.tax_id?.trim() && data?.address?.trim() ? data : null;
}
export function partyChecksum(party: Record<string, unknown>) {
  // Stable order, and only the contracting entity fields (not mutable contact email).
  return createHash('sha256').update(JSON.stringify(['legal_name', 'tax_id', 'address', 'postal_code', 'city', 'province']
    .map(key => [key, String(party[key] || '').trim()]))).digest('hex');
}
export async function companyContractAccepted(companyId: string) {
  if (process.env.CA46_REQUIRE_LEGAL_ACCEPTANCE !== 'true') return true;
  const current = contractSnapshot();
  if (!current.ready) return false;
  const party = await companyContractParty(companyId);
  if (!party) return false;
  const { data, error } = await supabaseAdmin.from('legal_acceptances').select('id')
    .eq('company_id', companyId).eq('version', current.version).eq('checksum', current.checksum).eq('party_checksum', partyChecksum(party)).limit(1).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
