import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpenCheck, CircleDollarSign, Link2, MousePointerClick, ShoppingBag, WalletCards } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, PageHeader, EmptyState, KpiCard } from '@/components/platform-shell';
import { getAdminAffiliateDetail } from '@/lib/admin-data';

export const dynamic='force-dynamic';

export default async function AdminAffiliateDetailPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect('/');
  const {data:me}=await supabase.from('profiles').select('full_name,role,status').eq('id',user.id).single(); if(!me||me.role!=='admin'||me.status!=='active')redirect('/');
  const detail=await getAdminAffiliateDetail(id);
  if (!detail) { redirect('/admin/afiliados'); return null; }
  const {affiliate,totals,links,payouts,progress,sales}=detail;
  const profile = Array.isArray(affiliate.profiles) ? affiliate.profiles[0] : affiliate.profiles;
  return <PlatformShell role="admin" name={me.full_name||'Administrador'}><div>
    <PageHeader eyebrow="PERFIL 360°" title={profile?.full_name||'Afiliado'} description={`Código ${affiliate.affiliate_code} · ${affiliate.status}`} action={<Link className="native-secondary" href="/admin/afiliados"><ArrowLeft size={15}/> Afiliados</Link>} />
    <div className="kpi-grid five">
      <KpiCard label="Clicks" value={String(totals.totalClicks)} helper="Tracking atribuido" accent="blue" />
      <KpiCard label="Ventas" value={String(totals.sales)} helper={`${totals.conversion.toFixed(2)}% conversión`} accent="green" />
      <KpiCard label="Facturación" value={`$${totals.totalRevenue.toFixed(2)}`} helper="Ventas confirmadas" accent="yellow" />
      <KpiCard label="Comisión" value={`$${totals.totalCommission.toFixed(2)}`} helper="Generada" accent="yellow" />
      <KpiCard label="Disponible" value={`$${totals.available.toFixed(2)}`} helper="Lista para retiro" accent="red" />
    </div>
    <section className="admin-profile-grid" style={{marginTop:16}}>
      <div className="panel-card"><div className="panel-heading"><div><span className="section-kicker">DATOS</span><h2>Información del afiliado</h2></div></div><div className="admin-detail-list"><div><span>Nombre</span><strong>{profile?.full_name||'Sin nombre'}</strong></div><div><span>Email</span><strong>{profile?.full_name ? 'Protegido por Auth' : '—'}</strong></div><div><span>Teléfono</span><strong>{profile?.phone||'No registrado'}</strong></div><div><span>País</span><strong>{profile?.country||'VE'}</strong></div><div><span>Comisión base</span><strong>{Number(affiliate.default_commission).toFixed(0)}%</strong></div><div><span>Registro</span><strong>{new Date(affiliate.created_at).toLocaleDateString('es-VE')}</strong></div></div></div>
      <div className="panel-card"><div className="panel-heading"><div><span className="section-kicker">ACCESOS</span><h2>Control operativo</h2></div></div><div className="quick-grid"><Link href="#ventas"><ShoppingBag/><span><strong>Ventas</strong><small>{sales.length} registros</small></span><ArrowRight/></Link><Link href="#enlaces"><Link2/><span><strong>Enlaces</strong><small>{links.length} enlaces</small></span><ArrowRight/></Link><Link href="#retiros"><WalletCards/><span><strong>Retiros</strong><small>{payouts.length} solicitudes</small></span><ArrowRight/></Link><Link href="#formacion"><BookOpenCheck/><span><strong>Formación</strong><small>{progress.filter((p:any)=>p.completed).length} lecciones</small></span><ArrowRight/></Link></div></div>
    </section>
    <section id="ventas" className="panel-card table-card" style={{marginTop:16}}><div className="panel-heading"><div><span className="section-kicker">VENTAS</span><h2>Últimas ventas</h2></div></div>{sales.length===0?<EmptyState icon={<ShoppingBag size={20}/>} title="Sin ventas" description="Este afiliado todavía no ha registrado ventas."/>:<div className="table-scroll"><table><thead><tr><th>Producto</th><th>Monto</th><th>Comisión</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>{sales.slice(0,20).map((s:any)=><tr key={s.id}><td>{s.products?.name||'Producto'}</td><td>${Number(s.gross_amount).toFixed(2)}</td><td>${Number(s.commission_amount).toFixed(2)}</td><td>{s.status}</td><td>{s.confirmed_at?new Date(s.confirmed_at).toLocaleDateString('es-VE'):'—'}</td></tr>)}</tbody></table></div>}</section>
    <section id="enlaces" className="panel-card table-card" style={{marginTop:16}}><div className="panel-heading"><div><span className="section-kicker">TRACKING</span><h2>Enlaces generados</h2></div><MousePointerClick size={18}/></div>{links.length===0?<EmptyState icon={<Link2 size={20}/>} title="Sin enlaces" description="Los enlaces creados por el afiliado aparecerán aquí."/>:<div className="table-scroll"><table><thead><tr><th>Código</th><th>Producto</th><th>Estado</th><th>Creado</th></tr></thead><tbody>{links.slice(0,20).map((l:any)=><tr key={l.id}><td><code>{l.code}</code></td><td>{l.products?.name||'Producto'}</td><td>{l.status}</td><td>{new Date(l.created_at).toLocaleDateString('es-VE')}</td></tr>)}</tbody></table></div>}</section>
    <section id="retiros" className="panel-card table-card" style={{marginTop:16}}><div className="panel-heading"><div><span className="section-kicker">RETIROS</span><h2>Historial</h2></div><WalletCards size={18}/></div>{payouts.length===0?<EmptyState icon={<WalletCards size={20}/>} title="Sin retiros" description="Las solicitudes del afiliado aparecerán aquí."/>:<div className="table-scroll"><table><thead><tr><th>Monto</th><th>Método</th><th>Estado</th><th>Solicitado</th></tr></thead><tbody>{payouts.slice(0,20).map((p:any)=><tr key={p.id}><td>${Number(p.amount).toFixed(2)}</td><td>{p.method}</td><td>{p.status}</td><td>{new Date(p.created_at).toLocaleDateString('es-VE')}</td></tr>)}</tbody></table></div>}</section>
  </div></PlatformShell>
}
