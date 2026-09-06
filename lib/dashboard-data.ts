import { createClient } from '@/lib/supabase/server';

export async function getAffiliateDashboard(userId: string) {
  const supabase = await createClient();
  const { data: affiliate } = await supabase.from('affiliates').select('id').eq('profile_id', userId).eq('status','active').single();
  if (!affiliate) return { clicks:0, sales:0, commission:0, available:0, conversion:0 };
  const [{ count: clicks }, { data: sales }, { data: commissions }, { data: allocations }] = await Promise.all([
    supabase.from('clicks').select('id', { count:'exact', head:true }).eq('affiliate_id', affiliate.id),
    supabase.from('sales').select('gross_amount').eq('affiliate_id', affiliate.id).eq('status','confirmed'),
    supabase.from('commissions').select('amount,status').eq('affiliate_id', affiliate.id),
    supabase.from('payout_commission_allocations').select('amount'),
  ]);
  const commission = (commissions ?? []).filter((r:any) => r.status !== 'reversed').reduce((s:number, r:any) => s + Number(r.amount || 0), 0);
  const allocated = (allocations ?? []).reduce((s:number, r:any) => s + Number(r.amount || 0), 0);
  const available = Math.max(0, (commissions ?? []).filter((r:any) => r.status === 'available').reduce((s:number, r:any) => s + Number(r.amount || 0), 0) - allocated);
  const salesCount = (sales ?? []).length;
  return { clicks: clicks ?? 0, sales: salesCount, commission, available, conversion: (clicks ?? 0) ? (salesCount / (clicks ?? 0)) * 100 : 0 };
}

export async function getAdminDashboard() {
  const supabase = await createClient();
  const [{ count: affiliates }, { count: activeAffiliates }, { count: clicks }, { data: sales }, { data: commissions }, { count: activeProducts }, { count: payoutRequests }] = await Promise.all([
    supabase.from('profiles').select('id',{count:'exact',head:true}).eq('role','affiliate'),
    supabase.from('profiles').select('id',{count:'exact',head:true}).eq('role','affiliate').eq('status','active'),
    supabase.from('clicks').select('id',{count:'exact',head:true}),
    supabase.from('sales').select('gross_amount,affiliate_id').eq('status','confirmed'),
    supabase.from('commissions').select('amount,status'),
    supabase.from('products').select('id',{count:'exact',head:true}).eq('status','active'),
    supabase.from('payouts').select('id',{count:'exact',head:true}).in('status',['requested','review','approved','processing']),
  ]);
  const revenue = (sales ?? []).reduce((s:number,r:any)=>s+Number(r.gross_amount||0),0);
  const commissionTotal = (commissions ?? []).filter((r:any)=>r.status !== 'reversed').reduce((s:number,r:any)=>s+Number(r.amount||0),0);
  return { affiliates:affiliates??0, activeAffiliates:activeAffiliates??0, clicks:clicks??0, sales:(sales??[]).length, revenue, commissionTotal, activeProducts:activeProducts??0, payoutRequests:payoutRequests??0, conversion:(clicks??0)?((sales??[]).length/(clicks??0))*100:0 };
}
