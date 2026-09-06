import { createClient } from '@/lib/supabase/server';

export async function getAffiliateAnalytics(userId: string, productSlug?: string) {
  const supabase = await createClient();
  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('id')
    .eq('profile_id', userId)
    .eq('status', 'active')
    .single();

  if (!affiliate) {
    return { totalClicks: 0, uniqueVisitors: 0, sales: 0, revenue: 0, commission: 0, available: 0, conversion: 0, byProduct: [], byDay: [], byChannel: [] };
  }

  let productId: string | undefined;
  if (productSlug) {
    const { data: product } = await supabase.from('products').select('id').eq('slug', productSlug).maybeSingle();
    productId = product?.id;
  }
  let clicksQuery = supabase.from('clicks').select('product_id,visitor_id,referrer,created_at').eq('affiliate_id', affiliate.id).order('created_at', { ascending: false }).limit(5000);
  let salesQuery = supabase.from('sales').select('product_id,gross_amount,commission_amount,status,created_at,products(name)').eq('affiliate_id', affiliate.id).order('created_at', { ascending: false }).limit(2000);
  if (productId) { clicksQuery = clicksQuery.eq('product_id', productId); salesQuery = salesQuery.eq('product_id', productId); }
  const [{ data: clicks }, { data: sales }, { data: commissions }, { data: allocations }] = await Promise.all([
    clicksQuery,
    salesQuery,
    supabase.from('commissions').select('amount,status').eq('affiliate_id', affiliate.id),
    supabase.from('payout_commission_allocations').select('amount'),
  ]);

  const clickRows = clicks ?? [];
  const saleRows = (sales ?? []).filter((s: any) => s.status === 'confirmed');
  const commissionRows = commissions ?? [];

  const totalClicks = clickRows.length;
  const uniqueVisitors = new Set(clickRows.map((c: any) => c.visitor_id)).size;
  const revenue = saleRows.reduce((n: number, s: any) => n + Number(s.gross_amount || 0), 0);
  const commission = commissionRows.filter((c: any) => c.status !== 'reversed').reduce((n: number, c: any) => n + Number(c.amount || 0), 0);
  const allocated = (allocations ?? []).reduce((n: number, a: any) => n + Number(a.amount || 0), 0);
  const available = Math.max(0, commissionRows.filter((c: any) => c.status === 'available').reduce((n: number, c: any) => n + Number(c.amount || 0), 0) - allocated);

  const products = new Map<string, { name: string; clicks: number; sales: number; revenue: number }>();
  clickRows.forEach((c: any) => {
    const key = c.product_id || 'unknown';
    const row = products.get(key) || { name: 'Producto', clicks: 0, sales: 0, revenue: 0 };
    row.clicks += 1;
    products.set(key, row);
  });
  saleRows.forEach((s: any) => {
    const key = s.product_id || 'unknown';
    const row = products.get(key) || { name: s.products?.name || 'Producto', clicks: 0, sales: 0, revenue: 0 };
    row.name = s.products?.name || row.name;
    row.sales += 1;
    row.revenue += Number(s.gross_amount || 0);
    products.set(key, row);
  });

  const byDayMap = new Map<string, number>();
  clickRows.forEach((c: any) => {
    const day = new Date(c.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
    byDayMap.set(day, (byDayMap.get(day) || 0) + 1);
  });

  const channelMap = new Map<string, number>();
  clickRows.forEach((c: any) => {
    const ref = String(c.referrer || '').toLowerCase();
    const channel = ref.includes('instagram') ? 'Instagram' : ref.includes('tiktok') ? 'TikTok' : ref.includes('facebook') ? 'Facebook' : ref.includes('whatsapp') ? 'WhatsApp' : ref ? 'Otro' : 'Directo';
    channelMap.set(channel, (channelMap.get(channel) || 0) + 1);
  });

  return {
    totalClicks,
    uniqueVisitors,
    sales: saleRows.length,
    revenue,
    commission,
    available,
    conversion: totalClicks ? (saleRows.length / totalClicks) * 100 : 0,
    byProduct: Array.from(products.values()).sort((a, b) => b.clicks - a.clicks).slice(0, 8),
    byDay: Array.from(byDayMap.entries()).slice(0, 14).map(([label, value]) => ({ label, value })).reverse(),
    byChannel: Array.from(channelMap.entries()).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })),
  };
}

export async function getAdminAnalytics() {
  const supabase = await createClient();
  const [{ data: clicks }, { data: sales }, { data: commissions }] = await Promise.all([
    supabase.from('clicks').select('affiliate_id,product_id,visitor_id,referrer,created_at').order('created_at', { ascending: false }).limit(10000),
    supabase.from('sales').select('affiliate_id,product_id,gross_amount,status,created_at,products(name)').order('created_at', { ascending: false }).limit(5000),
    supabase.from('commissions').select('affiliate_id,amount,status').limit(5000),
  ]);

  const clickRows = clicks ?? [];
  const saleRows = (sales ?? []).filter((s: any) => s.status === 'confirmed');
  const commissionRows = commissions ?? [];

  const affiliates = new Map<string, { clicks: number; uniqueVisitors: Set<string>; sales: number; revenue: number }>();
  clickRows.forEach((c: any) => {
    if (!c.affiliate_id) return;
    const row = affiliates.get(c.affiliate_id) || { clicks: 0, uniqueVisitors: new Set<string>(), sales: 0, revenue: 0 };
    row.clicks += 1;
    if (c.visitor_id) row.uniqueVisitors.add(c.visitor_id);
    affiliates.set(c.affiliate_id, row);
  });
  saleRows.forEach((s: any) => {
    if (!s.affiliate_id) return;
    const row = affiliates.get(s.affiliate_id) || { clicks: 0, uniqueVisitors: new Set<string>(), sales: 0, revenue: 0 };
    row.sales += 1;
    row.revenue += Number(s.gross_amount || 0);
    affiliates.set(s.affiliate_id, row);
  });

  const commissionTotal = commissionRows.filter((c: any) => c.status !== 'reversed').reduce((n: number, c: any) => n + Number(c.amount || 0), 0);
  const revenue = saleRows.reduce((n: number, s: any) => n + Number(s.gross_amount || 0), 0);
  const affiliateIds = Array.from(affiliates.keys());
  const affiliateNameMap = new Map<string, string>();
  if (affiliateIds.length) {
    const { data: affiliateRows } = await supabase.from('affiliates').select('id,profiles(full_name)').in('id', affiliateIds);
    for (const row of affiliateRows ?? []) {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      affiliateNameMap.set(row.id, profile?.full_name || 'Afiliado');
    }
  }

  const productMap = new Map<string, { name: string; clicks: number; sales: number }>();
  clickRows.forEach((c: any) => {
    if (!c.product_id) return;
    const row = productMap.get(c.product_id) || { name: 'Producto', clicks: 0, sales: 0 };
    row.clicks += 1;
    productMap.set(c.product_id, row);
  });
  saleRows.forEach((s: any) => {
    if (!s.product_id) return;
    const row = productMap.get(s.product_id) || { name: s.products?.name || 'Producto', clicks: 0, sales: 0 };
    row.name = s.products?.name || row.name;
    row.sales += 1;
    productMap.set(s.product_id, row);
  });

  const channels = new Map<string, number>();
  clickRows.forEach((c: any) => {
    const ref = String(c.referrer || '').toLowerCase();
    const channel = ref.includes('instagram') ? 'Instagram' : ref.includes('tiktok') ? 'TikTok' : ref.includes('facebook') ? 'Facebook' : ref.includes('whatsapp') ? 'WhatsApp' : ref ? 'Otro' : 'Directo';
    channels.set(channel, (channels.get(channel) || 0) + 1);
  });

  return {
    clicks: clickRows.length,
    uniqueVisitors: new Set(clickRows.map((c: any) => c.visitor_id).filter(Boolean)).size,
    sales: saleRows.length,
    revenue,
    commissionTotal,
    conversion: clickRows.length ? (saleRows.length / clickRows.length) * 100 : 0,
    affiliateStats: Array.from(affiliates.entries()).map(([id, row]) => ({ id, name: affiliateNameMap.get(id) || 'Afiliado', clicks: row.clicks, visitors: row.uniqueVisitors.size, sales: row.sales, revenue: row.revenue, conversion: row.clicks ? row.sales / row.clicks * 100 : 0 })).sort((a, b) => b.sales - a.sales || b.clicks - a.clicks),
    products: Array.from(productMap.values()).sort((a, b) => b.clicks - a.clicks),
    channels: Array.from(channels.entries()).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })),
  };
}
