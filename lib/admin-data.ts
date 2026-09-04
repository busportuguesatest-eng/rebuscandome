import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type AffiliateRow = {
  id: string;
  affiliate_code: string;
  status: string;
  created_at: string;
  profile_id: string;
  name: string;
  phone: string;
  clicks: number;
  sales: number;
  revenue: number;
  commission: number;
  available: number;
  conversion: number;
};

export async function getAdminAffiliates(): Promise<AffiliateRow[]> {
  const supabase = await createClient();
  const { data: affiliates } = await supabase
    .from('affiliates')
    .select('id,profile_id,affiliate_code,status,created_at,profiles(full_name,phone,role)')
    .order('created_at', { ascending: false });

  const affiliateRows = (affiliates ?? []).filter((a: any) => a.profiles?.role === 'affiliate');
  if (!affiliateRows.length) return [];

  const ids = affiliateRows.map((a: any) => a.id);
  const [{ data: sales }, { data: commissions }, { data: clicks }, { data: allocations }] = await Promise.all([
    supabase.from('sales').select('affiliate_id,gross_amount,status').in('affiliate_id', ids),
    supabase.from('commissions').select('affiliate_id,amount,status').in('affiliate_id', ids),
    supabase.from('clicks').select('affiliate_id').in('affiliate_id', ids),
    supabase.from('payout_commission_allocations').select('amount,commissions!inner(affiliate_id)'),
  ]);

  return affiliateRows.map((a: any) => {
    const aClicks = (clicks ?? []).filter((r: any) => r.affiliate_id === a.id).length;
    const aSales = (sales ?? []).filter((r: any) => r.affiliate_id === a.id && r.status === 'confirmed');
    const aCommissions = (commissions ?? []).filter((r: any) => r.affiliate_id === a.id && r.status !== 'reversed');
    const allocated = (allocations ?? []).filter((r: any) => r.commissions?.affiliate_id === a.id).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const available = Math.max(0, aCommissions.filter((r: any) => r.status === 'available').reduce((s: number, r: any) => s + Number(r.amount || 0), 0) - allocated);
    const commission = aCommissions.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const revenue = aSales.reduce((s: number, r: any) => s + Number(r.gross_amount || 0), 0);
    return {
      id: a.id,
      profile_id: a.profile_id,
      affiliate_code: a.affiliate_code,
      status: a.status,
      created_at: a.created_at,
      name: a.profiles?.full_name || 'Sin nombre',
      phone: a.profiles?.phone || '',
      clicks: aClicks,
      sales: aSales.length,
      revenue,
      commission,
      available,
      conversion: aClicks ? (aSales.length / aClicks) * 100 : 0,
    };
  });
}

export async function getAdminAffiliateDetail(id: string) {
  const supabase = createServiceClient();
  let affiliate: any = null;
  const byAffiliate = await supabase.from('affiliates').select('id,profile_id,affiliate_code,status,default_commission,created_at,profiles(full_name,phone,country,status,created_at)').eq('id', id).maybeSingle();
  affiliate = byAffiliate.data;
  if (!affiliate) {
    const byProfile = await supabase.from('affiliates').select('id,profile_id,affiliate_code,status,default_commission,created_at,profiles(full_name,phone,country,status,created_at)').eq('profile_id', id).maybeSingle();
    affiliate = byProfile.data;
  }
  if (!affiliate) return null;
  const [{ data: clicks }, { data: sales }, { data: commissions }, { data: payouts }, { data: links }, { data: progress }, { data: allocations }] = await Promise.all([
    supabase.from('clicks').select('id,product_id,created_at').eq('affiliate_id', affiliate.id).order('created_at', { ascending: false }).limit(200),
    supabase.from('sales').select('id,product_id,gross_amount,commission_amount,currency,status,confirmed_at,created_at,products(name)').eq('affiliate_id', affiliate.id).order('created_at', { ascending: false }).limit(100),
    supabase.from('commissions').select('id,amount,status,created_at').eq('affiliate_id', affiliate.id).order('created_at', { ascending: false }).limit(100),
    supabase.from('payouts').select('id,amount,method,status,created_at,paid_at').eq('affiliate_id', affiliate.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('tracking_links').select('id,code,product_id,status,created_at,products(name)').eq('affiliate_id', affiliate.id).order('created_at', { ascending: false }).limit(100),
    supabase.from('lesson_progress').select('completed_at,lesson_id,lessons(course_id,courses(title))').eq('user_id', affiliate.profile_id).limit(200),
    supabase.from('payout_commission_allocations').select('amount,commissions!inner(affiliate_id)').eq('commissions.affiliate_id', affiliate.id),
  ]);
  const confirmedSales = (sales ?? []).filter((s: any) => s.status === 'confirmed');
  const totalRevenue = confirmedSales.reduce((n: number, s: any) => n + Number(s.gross_amount || 0), 0);
  const totalCommission = (commissions ?? []).filter((c: any) => c.status !== 'reversed').reduce((n: number, c: any) => n + Number(c.amount || 0), 0);
  const allocated = (allocations ?? []).reduce((n: number, a: any) => n + Number(a.amount || 0), 0);
  const available = Math.max(0, (commissions ?? []).filter((c: any) => c.status === 'available').reduce((n: number, c: any) => n + Number(c.amount || 0), 0) - allocated);
  const totalClicks = clicks?.length ?? 0;
  const conversion = totalClicks ? (confirmedSales.length / totalClicks) * 100 : 0;
  return { affiliate, clicks: clicks ?? [], sales: sales ?? [], commissions: commissions ?? [], payouts: payouts ?? [], links: links ?? [], progress: progress ?? [], totals: { totalClicks, sales: confirmedSales.length, totalRevenue, totalCommission, available, conversion } };
}
