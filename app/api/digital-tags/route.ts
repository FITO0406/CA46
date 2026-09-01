import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('digital_tags')
      .select('*')
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tags:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || [], { status: 200 });
  } catch (err: any) {
    console.error('GET digital-tags error:', err);
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, price, origin } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing tag ID' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('digital_tags')
      .update({
        price,
        origin,
        last_synced_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error updating tag:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || [], { status: 200 });
  } catch (err: any) {
    console.error('PUT digital-tags error:', err);
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 });
  }
}
