import { createClient } from '@supabase/supabase-js';
import { assertProductionTarget, ALLOWED_PRODUCTION_SUPABASE_URL } from './targetGuard';

const SUPABASE_URL = ALLOWED_PRODUCTION_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_7qFeNP7a1ZNZ_NbhYdrwmw_DxzHJrJv';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Fail-Closed assertion
assertProductionTarget(SUPABASE_URL);

// Public client (anon key) – for browser/frontend use
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Server-side admin client (service_role key) – bypasses RLS, use only in API routes
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY);
