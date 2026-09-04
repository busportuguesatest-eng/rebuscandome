import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSameOrigin } from '@/lib/security/request';

async function adminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, response: NextResponse.json({ ok:false, message:'No autenticado.' }, { status:401 }) };
  const { data: profile } = await supabase.from('profiles').select('role,status').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin' || profile.status !== 'active') return { supabase, response: NextResponse.json({ ok:false, message:'No autorizado.' }, { status:403 }) };
  return { supabase, response: null };
}

export async function GET(request: Request) {
  const same = requireSameOrigin(request); if (same) return same;
  const guard = await adminClient(); if (guard.response) return guard.response;
  const { data, error } = await guard.supabase.from('payment_method_settings').select('*').order('method');
  if (error) return NextResponse.json({ ok:false, message:'No se pudieron cargar los métodos de pago.' }, { status:500 });
  return NextResponse.json({ ok:true, methods:data ?? [] });
}

export async function POST(request: Request) {
  const same = requireSameOrigin(request); if (same) return same;
  const guard = await adminClient(); if (guard.response) return guard.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok:false, message:'Solicitud inválida.' }, { status:400 });
  const method = body.method === 'transferencia' ? 'transferencia' : body.method === 'pago_movil' ? 'pago_movil' : null;
  if (!method) return NextResponse.json({ ok:false, message:'Método inválido.' }, { status:400 });
  const row = {
    method,
    enabled: Boolean(body.enabled),
    bank_name: String(body.bank_name ?? '').trim().slice(0,120),
    account: String(body.account ?? '').trim().slice(0,80),
    account_type: String(body.account_type ?? '').trim().slice(0,60),
    holder: String(body.holder ?? '').trim().slice(0,160),
    identifier: String(body.identifier ?? '').trim().slice(0,60),
    phone: String(body.phone ?? '').trim().slice(0,40),
    updated_at: new Date().toISOString(),
  };
  const commonReady = method === 'pago_movil' ? Boolean(row.bank_name && row.identifier) : Boolean(row.bank_name && row.holder && row.account);
  const specificReady = method === 'pago_movil' ? row.phone : row.account;
  if (row.enabled && (!commonReady || !specificReady)) return NextResponse.json({ ok:false, message:'Completa Banco, Titular, Identificación y el dato específico del método antes de activarlo.' }, { status:400 });
  const { data, error } = await guard.supabase.from('payment_method_settings').upsert(row, { onConflict:'method' }).select('*').single();
  if (error) return NextResponse.json({ ok:false, message:'No se pudo guardar la configuración.' }, { status:500 });
  return NextResponse.json({ ok:true, method:data });
}
