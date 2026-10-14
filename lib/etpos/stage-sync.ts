import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import type { LabelSource } from './sync-contract';

type QueueLabel = {
  companyId: string;
  labelId: string;
  source: LabelSource;
  productName: string;
  lotCode: string;
  parentLotCode?: string;
  expiresAt: string;
  approvedForSale: boolean;
};

/**
 * Stages a future synchronization, NEVER performs an ETPOS write.
 * Commercial article codes/families remain unset until mapped by each
 * company. Retried requests are deduplicated by (company,label,revision,action).
 */
export async function stageEtposLabelSync(input: QueueLabel): Promise<void> {
  if (!input.companyId || !input.labelId || !input.productName || !input.lotCode) {
    throw new Error('Incomplete ETPOS label staging payload');
  }
  // Initial publication uses revision 1. Recovery/updates must allocate a
  // monotonic revision transactionally before reusing this function.
  const revision = 1;
  const { error } = await supabaseAdmin.from('etpos_sync_outbox').upsert({
    company_id: input.companyId,
    label_id: input.labelId,
    revision,
    action: 'upsert',
    source: input.source,
    status: 'pending_mapping',
    payload: {
      productName: input.productName,
      lotCode: input.lotCode,
      parentLotCode: input.parentLotCode ?? null,
      expiresAt: input.expiresAt,
      approvedForSale: input.approvedForSale,
      // No guessed product/family or scale connection data.
      commercialFamilyCode: null,
      productCode: null,
    },
  }, { onConflict: 'company_id,label_id,revision,action', ignoreDuplicates: true });
  if (error) throw error;
}
