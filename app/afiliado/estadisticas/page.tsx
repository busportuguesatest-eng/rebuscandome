import { redirect } from 'next/navigation';
import { BarChart3, MousePointerClick, ShoppingBag, CircleDollarSign, Users, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, PageHeader, KpiCard, EmptyState } from '@/components/platform-shell';
import { getAffiliateAnalytics } from '@/lib/analytics';

export const dynamic = 'force-dynamic';

export default async function AffiliateStatsPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');
  const { data: profile } = await supabase.from('profiles').select('full_name,role,status').eq('id', user.id).single();
  if (!profile || profile.role !== 'affiliate' || profile.status !== 'active') redirect('/');
  let productName = '';
  if (params.product) {
    const { data: product } = await supabase.from('products').select('name').eq('slug', params.product).maybeSingle();
    productName = product?.name || '';
  }
  const stats = await getAffiliateAnalytics(user.id, params.product);
  const maxDay = Math.max(...stats.byDay.map(x => x.value), 1);
  const money = (n: number) => `$${n.toFixed(2)}`;

  return <PlatformShell role="affiliate" name={profile.full_name || 'Afiliado'}>
    <PageHeader eyebrow="RENDIMIENTO" title={productName ? `Rendimiento · ${productName}` : "Tus resultados, sin complicaciones"} description={productName ? "Métricas de este producto para ayudarte a decidir qué publicar y dónde invertir tu esfuerzo." : "Todo lo que ocurre con tus enlaces y ventas, calculado desde los datos reales del sistema."} action={productName ? <Link className="native-secondary" href="/afiliado/estadisticas"><BarChart3 size={15}/> Ver resumen general</Link> : undefined} />
    <section className="visual-section-banner stats-banner"><div className="visual-section-copy"><span>RENDIMIENTO</span><h2>Convierte actividad en decisiones.</h2><p>Lee tus clicks, ventas y conversión para saber qué producto merece más esfuerzo.</p></div></section>
    <div className="kpi-grid five">
      <KpiCard label="Clicks" value={stats.totalClicks.toLocaleString('es-VE')} helper="Tráfico registrado" accent="blue" />
      <KpiCard label="Visitantes únicos" value={stats.uniqueVisitors.toLocaleString('es-VE')} helper="Usuarios identificados" accent="blue" />
      <KpiCard label="Ventas" value={String(stats.sales)} helper={`${stats.conversion.toFixed(2)}% conversión`} accent="green" />
      <KpiCard label="Generado" value={money(stats.commission)} helper="Comisiones acumuladas" accent="yellow" />
      <KpiCard label="Disponible" value={money(stats.available)} helper="Listo para retirar" accent="red" />
    </div>

    {!stats.totalClicks && !stats.sales ? <div style={{marginTop:18}}><EmptyState icon={<BarChart3 size={22}/>} title="Aún no hay actividad" description="Cuando compartas tu enlace y lleguen tus primeros visitantes, aquí aparecerán tus estadísticas reales." action={<Link className="native-primary" href="/afiliado/productos">Ver productos</Link>} /></div> : <>
      <section className="native-grid two-col" style={{marginTop:18}}>
        <div className="native-card">
          <div className="native-card-head"><div><span className="native-eyebrow">EVOLUCIÓN</span><h2>Clicks recientes</h2></div><MousePointerClick size={18}/></div>
          <div className="mini-bars">{stats.byDay.map((d) => <div key={d.label}><span style={{height:`${Math.max(8, d.value/maxDay*100)}%`}} title={`${d.label}: ${d.value}`}/><small>{d.label}</small></div>)}</div>
        </div>
        <div className="native-card">
          <div className="native-card-head"><div><span className="native-eyebrow">EMBUDO</span><h2>Tráfico → venta</h2></div><ArrowUpRight size={18}/></div>
          <div className="funnel-list">
            <div><span>Clicks</span><strong>{stats.totalClicks}</strong></div>
            <div><span>Visitantes únicos</span><strong>{stats.uniqueVisitors}</strong></div>
            <div><span>Ventas</span><strong>{stats.sales}</strong></div>
            <div><span>Conversión</span><strong>{stats.conversion.toFixed(2)}%</strong></div>
          </div>
        </div>
      </section>
      <section className="native-grid two-col" style={{marginTop:18}}>
        <div className="native-card"><div className="native-card-head"><div><span className="native-eyebrow">PRODUCTOS</span><h2>Rendimiento por producto</h2></div><ShoppingBag size={18}/></div>{stats.byProduct.length===0?<p className="native-muted">Sin datos por producto.</p>:<div className="native-list">{stats.byProduct.map((p)=><div className="native-product" key={p.name}><div><div className="native-product-title">{p.name}</div><div className="native-muted">{p.clicks} clicks · {p.sales} ventas · {p.clicks?((p.sales/p.clicks)*100).toFixed(2):'0.00'}%</div></div><strong>{money(p.revenue)}</strong></div>)}</div>}</div>
        <div className="native-card"><div className="native-card-head"><div><span className="native-eyebrow">CANALES</span><h2>De dónde llega tu tráfico</h2></div><Users size={18}/></div><div className="native-list">{stats.byChannel.length===0?<p className="native-muted">Todavía no hay datos de origen.</p>:stats.byChannel.map(c=><div className="native-product" key={c.label}><div className="native-product-title">{c.label}</div><strong>{c.value}</strong></div>)}</div></div>
      </section>
    </>}
  </PlatformShell>;
}
