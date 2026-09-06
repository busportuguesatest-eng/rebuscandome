import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, CircleDollarSign, Package, Users, MousePointerClick, ShoppingBag, WalletCards } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, KpiCard, PageHeader, EmptyState } from '@/components/platform-shell';
import { getAdminDashboard } from '@/lib/dashboard-data';
import { getAdminAnalytics } from '@/lib/analytics';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');
  const { data: profile } = await supabase.from('profiles').select('full_name,role,status').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin' || profile.status !== 'active') redirect('/');
  const [stats, analytics] = await Promise.all([getAdminDashboard(), getAdminAnalytics()]);
  const money = (n:number) => `$${n.toFixed(2)}`;
  return <PlatformShell role="admin" name={profile.full_name || 'Administrador'}>
    <PageHeader eyebrow="CENTRO DE CONTROL" title="Todo el negocio en una sola vista" description="KPIs y actividad reales del programa. Esta interfaz deja de usar datos demo: solo muestra lo que exista en Supabase." action={<span className="live-chip">Datos reales</span>} />
    <div className="kpi-grid five">
      <KpiCard label="Afiliados" value={String(stats.affiliates)} helper={`${stats.activeAffiliates} activos`} accent="blue" />
      <KpiCard label="Clicks" value={stats.clicks.toLocaleString('es-VE')} helper="Tracking registrado" accent="blue" />
      <KpiCard label="Ventas" value={String(stats.sales)} helper={`${stats.conversion.toFixed(2)}% conversión`} accent="green" />
      <KpiCard label="Facturación" value={money(stats.revenue)} helper="Ventas confirmadas" accent="yellow" />
      <KpiCard label="Retiros" value={String(stats.payoutRequests)} helper="Solicitudes abiertas" accent="red" />
    </div>
    <section className="visual-section-banner admin-banner"><div className="visual-section-copy"><span>CENTRO DE MANDO</span><h2>Una vista clara de todo el negocio.</h2><p>Afiliados, ventas, comisiones y actividad conectados en un mismo lugar.</p></div></section>
    <section className="admin-command-grid">
      <div className="panel-card dark-panel"><div className="panel-heading"><div><span className="section-kicker light">SALUD DEL PROGRAMA</span><h2>Estado actual</h2></div><ShoppingBag size={18}/></div><div className="health-list"><div><span>Productos activos</span><strong>{stats.activeProducts}</strong></div><div><span>Comisión generada</span><strong>{money(stats.commissionTotal)}</strong></div><div><span>Conversión global</span><strong>{stats.conversion.toFixed(2)}%</strong></div></div></div>
      <div className="panel-card"><div className="panel-heading"><div><span className="section-kicker">ACCIONES</span><h2>Gestión rápida</h2></div></div><div className="quick-grid"><Link href="/admin/productos"><Package/><span><strong>Productos</strong><small>Crear o administrar catálogo</small></span><ArrowRight/></Link><Link href="/admin/afiliados"><Users/><span><strong>Afiliados</strong><small>Revisar actividad y rendimiento</small></span><ArrowRight/></Link><Link href="/admin/finanzas"><CircleDollarSign/><span><strong>Ventas</strong><small>Ventas, comisiones y retiros</small></span><ArrowRight/></Link><Link href="/admin/finanzas#retiros"><WalletCards/><span><strong>Retiros</strong><small>Gestionar solicitudes</small></span><ArrowRight/></Link></div></div>
    </section>
    <section className="panel-card" style={{marginTop:16}}><div className="panel-heading"><div><span className="section-kicker">SISTEMA</span><h2>Conexión entre Afiliado y Administración</h2></div><MousePointerClick size={18}/></div><div className="system-flow"><div><strong>Afiliado</strong><span>Genera enlace</span></div><i>→</i><div><strong>Tracking</strong><span>Registra click</span></div><i>→</i><div><strong>Cliente</strong><span>Visita landing</span></div><i>→</i><div><strong>Venta</strong><span>Se atribuye</span></div><i>→</i><div><strong>Comisión</strong><span>Se calcula</span></div></div></section>
    <section className="native-grid two-col" style={{marginTop:18}}>
      <div className="native-card"><div className="native-card-head"><div><span className="native-eyebrow">TRÁFICO REAL</span><h2>Clicks por canal</h2></div><MousePointerClick size={18}/></div>{analytics.channels.length===0?<div className="native-empty">Todavía no hay clicks registrados.</div>:<div className="native-list">{analytics.channels.map(c=><div className="native-product" key={c.label}><div className="native-product-title">{c.label}</div><strong>{c.value}</strong></div>)}</div>}<div className="table-note">Fuente: tabla <strong>clicks</strong> de Supabase.</div></div>
      <div className="native-card"><div className="native-card-head"><div><span className="native-eyebrow">AFILIADOS</span><h2>Rendimiento comercial</h2></div><Users size={18}/></div>{analytics.affiliateStats.length===0?<div className="native-empty">Los afiliados aparecerán aquí cuando generen actividad.</div>:<div className="native-list">{analytics.affiliateStats.slice(0,6).map(a=><div className="native-product" key={a.id}><div><div className="native-product-title">{a.name}</div><div className="native-muted">{a.clicks} clicks · {a.sales} ventas · {a.conversion.toFixed(2)}%</div></div><strong>${a.revenue.toFixed(2)}</strong></div>)}</div>}<div className="table-note">Las cifras se agrupan desde el mismo tracking que consulta cada afiliado.</div></div>
    </section>
    {stats.affiliates === 0 && <div style={{marginTop:16}}><EmptyState icon={<Users size={22}/>} title="Todavía no hay afiliados registrados" description="Cuando se registren, sus perfiles y actividad aparecerán automáticamente aquí." /></div>}
  </PlatformShell>;
}
