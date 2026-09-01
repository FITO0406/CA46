import { createClient } from '@supabase/supabase-js';
import { assertProductionTarget, ALLOWED_PRODUCTION_SUPABASE_URL } from './targetGuard';

// Published anon key for xcjhqyjqakknnfbjxlui
const DEFAULT_PRODUCTION_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjamhxeWpxYWtubmZianhsdWkiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc3OTA1MzUyMiwiZXhwIjoyMDk0NjI5NTIyfQ.dGq_Hq_oT552-k4r54G4';

const supabaseUrl = ALLOWED_PRODUCTION_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_PRODUCTION_ANON_KEY;

// Fail-Closed assertion
assertProductionTarget(supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
