import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSameOrigin } from '@/lib/security/request';

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const guard = requireSameOrigin(_);
  if (guard) return guard;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role,status').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin' || profile.status !== 'active') return NextResponse.json({ error: 'Acceso administrativo requerido.' }, { status: 403 });
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Payout inválido.' }, { status: 400 });
  const { data, error } = await supabase.rpc('reverse_paid_payout', { p_payout_id: id });
  if (error) return NextResponse.json({ error: 'No se pudo revertir el pago.' }, { status: 400 });
  return NextResponse.json({ payout: Array.isArray(data) ? data[0] : data });
}
