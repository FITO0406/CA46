import { createClient } from '@supabase/supabase-js';

// Configuración "Antigravity": Credenciales integradas
// Sustituye estos valores por los de tu proyecto de Supabase
const supabaseUrl = 'TU_SUPABASE_URL';
const supabaseAnonKey = 'TU_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
