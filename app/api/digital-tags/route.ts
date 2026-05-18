import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
      const { data, error } = await supabase
            .from('digital_tags')
                  .select('*')
                        .order('product_name', { ascending: true });
                        
                            if (error) {
                                  console.error('Supabase error:', error);
                                        return NextResponse.json({ error: error.message }, { status: 500 });
                                            }
                                            
                                                return NextResponse.json(data);
                                                  } catch (err) {
                                                      console.error('API Error:', err);
                                                          return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
                                                            }
                                                            }
