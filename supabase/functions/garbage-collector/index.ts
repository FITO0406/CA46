import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Endpoint invocado por el Cron Job de Supabase (pg_net)
serve(async (req) => {
  try {
    // Validar Authorization header si es necesario para seguridad (Service Role)
    
    // Inicializar el cliente de Supabase usando variables de entorno
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Ejecutar el query de purga masiva: 
    // UPDATE digital_tags SET is_active = false WHERE expires_at <= NOW() AND is_active = true
    const { data, error } = await supabase
      .from('digital_tags')
      .update({ is_active: false })
      .lte('expires_at', new Date().toISOString())
      .eq('is_active', true)
      
    if (error) throw error

    return new Response(JSON.stringify({ message: "Garbage Collector ejecutado con éxito", data }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    })
  }
})
