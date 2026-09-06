import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSameOrigin } from '@/lib/security/request';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, response: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('role,status').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin' || profile.status !== 'active') return { supabase, response: NextResponse.json({ error: 'Acceso administrativo requerido.' }, { status: 403 }) };
  return { supabase, response: null };
}

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const guard = requireSameOrigin(_);
  if (guard) return guard;
  const { supabase, response } = await requireAdmin();
  if (response) return response;
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Payout inválido.' }, { status: 400 });
  const { data, error } = await supabase.rpc('mark_payout_paid', { p_payout_id: id });
  if (error) return NextResponse.json({ error: error.message.includes('PAYOUT_FUNDS_CHANGED') ? 'El saldo disponible cambió. Revisa el retiro antes de pagarlo.' : 'No se pudo marcar el retiro como pagado.' }, { status: 400 });
  return NextResponse.json({ payout: Array.isArray(data) ? data[0] : data });
}
