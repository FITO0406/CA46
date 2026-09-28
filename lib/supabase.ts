import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { assertProductionTarget, ALLOWED_PRODUCTION_SUPABASE_URL } from './targetGuard';

const SUPABASE_URL = ALLOWED_PRODUCTION_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_7qFeNP7a1ZNZ_NbhYdrwmw_DxzHJrJv';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

assertProductionTarget(SUPABASE_URL);

// Cliente público disponible solo para código de servidor que necesite la clave anon.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cliente administrativo: solo servidor y siempre fail-closed si falta la service role.
export const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY || 'missing-service-role-key',
);
