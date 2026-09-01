import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    // Autenticar la petición cron mediante un secreto si es necesario
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { data, error } = await supabase
      .from('digital_tags')
      .update({ is_active: false })
      .lte('expires_at', new Date().toISOString())
      .eq('is_active', true);
      
    if (error) throw error;

    return NextResponse.json({ message: "Garbage Collector ejecutado con éxito", data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
