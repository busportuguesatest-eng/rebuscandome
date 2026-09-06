import { ArrowRight, BookOpen, Package, Sparkles, ShoppingBag, WalletCards } from 'lucide-react';
import Link from 'next/link';
import { KpiCard } from './platform-shell';

export function AffiliateDashboard({ name, stats, showOnboarding }: { name:string; stats:{ clicks:number; sales:number; commission:number; available:number; conversion:number }; showOnboarding:boolean }) {
  const first = name.split(' ')[0] || 'Afiliado';
  return <>
    <section className="hero-card affiliate-hero visual-home-hero">
      <div><span className="hero-kicker">TU ESPACIO EN REBUSCÁNDOME</span><h1>Hola, {first} 👋</h1><p>Todo lo que necesitas para aprender, promocionar productos y convertir tu actividad en ingresos.</p></div>
      <div className="hero-goal"><span>Tu siguiente paso</span><strong>Entrar a Centro de Venta</strong><small>Ahí encontrarás estrategia, contenido y tu enlace.</small></div>
    </section>
    {showOnboarding && <div className="soft-banner"><Sparkles size={16}/><div><strong>Bienvenido, {first}.</strong><span>Te recomendamos completar tu preparación inicial para aprovechar mejor la plataforma.</span></div><Link href="/afiliado/academia">Empezar <ArrowRight size={14}/></Link></div>}
    <div className="kpi-grid four"><KpiCard label="Clicks" value={stats.clicks.toLocaleString('es-VE')} helper={stats.clicks?'Visitas atribuidas':'Aún no tienes actividad'}/><KpiCard label="Ventas" value={String(stats.sales)} helper={stats.sales?'Ventas confirmadas':'Aún sin ventas'} accent="green"/><KpiCard label="Conversión" value={`${stats.conversion.toFixed(2)}%`} helper={stats.clicks?'Ventas ÷ clicks':'Se calculará con tráfico'} accent="yellow"/><KpiCard label="Disponible" value={`$${stats.available.toFixed(2)}`} helper={stats.available?'Listo para retirar':'Sin saldo liberado'} accent="blue"/></div>
    <section className="dashboard-grid" style={{marginTop:16}}>
      <div className="panel-card"><div className="panel-heading"><div><span className="section-kicker">TU CAMINO</span><h2>Hazlo simple</h2></div><ShoppingBag size={18}/></div><div className="action-stack">
        <Link href="/afiliado/productos"><Package/><div><strong>Elige qué vender</strong><span>Revisa los productos y cuánto ganas por cada venta.</span></div><ArrowRight/></Link>
        <Link href="/afiliado/centro-venta"><ShoppingBag/><div><strong>Aprende y promociona</strong><span>Encuentra la estrategia, los recursos y tu enlace en un solo lugar.</span></div><ArrowRight/></Link>
        <Link href="/afiliado/ingresos"><WalletCards/><div><strong>Revisa tus ingresos</strong><span>Consulta lo generado, disponible y tu historial de retiros.</span></div><ArrowRight/></Link>
      </div></div>
      <div className="panel-card"><div className="panel-heading"><div><span className="section-kicker">RESUMEN</span><h2>Tu cuenta</h2></div></div><div className="mini-metrics"><div><span>Ganado</span><strong>${stats.commission.toFixed(2)}</strong></div><div><span>Ventas</span><strong>{stats.sales}</strong></div><div><span>Conversión</span><strong>{stats.conversion.toFixed(2)}%</strong></div><div><span>Saldo</span><strong>${stats.available.toFixed(2)}</strong></div></div></div>
    </section>
  </>;
}
