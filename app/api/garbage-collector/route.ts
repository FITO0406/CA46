import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return new NextResponse('Cron no configurado', { status: 503 });
    }

    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
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
