import { createClient } from '@supabase/supabase-js';
import { ALLOWED_PRODUCTION_SUPABASE_URL } from './targetGuard';

const supabaseUrl = ALLOWED_PRODUCTION_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_7qFeNP7a1ZNZ_NbhYdrwmw_DxzHJrJv';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
