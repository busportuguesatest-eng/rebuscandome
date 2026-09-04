import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSameOrigin } from '@/lib/security/request';

export async function POST(request: Request) {
  const same = requireSameOrigin(request); if (same) return same;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok:false, error:'NO_AUTHENTICATED' }, { status:401 });
  const { data: profile } = await supabase.from('profiles').select('id,role,status,onboarding_data').eq('id',user.id).single();
  if (!profile || profile.role !== 'affiliate' || profile.status !== 'active') return NextResponse.json({ ok:false, error:'AFFILIATE_NOT_AVAILABLE' }, { status:403 });
  const b = await request.json().catch(()=>null) as Record<string,unknown>|null;
  if (!b) return NextResponse.json({ ok:false, error:'INVALID_JSON' }, { status:400 });
  const method = String(b.method || 'pago_movil').trim();
  const payout = { method: method === 'transferencia' ? 'transferencia' : 'pago_movil', bank_name: String(b.bank_name || '').trim().slice(0,120), account: String(b.account || '').trim().slice(0,80), account_type: String(b.account_type || '').trim().slice(0,60), holder: String(b.holder || '').trim().slice(0,160), identifier: String(b.identifier || '').trim().slice(0,60), phone: String(b.phone || '').trim().slice(0,40) };
  if (!payout.bank_name || !payout.holder || !payout.identifier) return NextResponse.json({ ok:false, error:'PAYOUT_PROFILE_INCOMPLETE' }, { status:400 });
  if (payout.method === 'transferencia' && !payout.account) return NextResponse.json({ ok:false, error:'BANK_ACCOUNT_REQUIRED' }, { status:400 });
  if (payout.method === 'pago_movil' && !payout.phone) return NextResponse.json({ ok:false, error:'PAYMENT_PHONE_REQUIRED' }, { status:400 });
  const existing = (profile.onboarding_data && typeof profile.onboarding_data === 'object') ? profile.onboarding_data as Record<string,unknown> : {};
  const { error } = await supabase.from('profiles').update({ onboarding_data: { ...existing, payout } }).eq('id', user.id);
  if (error) return NextResponse.json({ ok:false, error:'PAYOUT_PROFILE_SAVE_FAILED' }, { status:500 });
  return NextResponse.json({ ok:true, payout });
}
