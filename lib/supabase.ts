import { createClient } from '@supabase/supabase-js';

// Configuración "Antigravity": Credenciales integradas
// Sustituye estos valores por los de tu proyecto de Supabase
const supabaseUrl = 'https://vtflazurmjdbaqgsrioh.supabase.co';
const supabaseAnonKey = 'sb_publishable_TsBlDoaRzUwpQcSf9v6uQQ_YvBxifys';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
