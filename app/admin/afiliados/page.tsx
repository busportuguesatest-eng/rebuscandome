import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Users, Activity, MousePointerClick, ShoppingBag, CircleDollarSign } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, EmptyState, PageHeader, KpiCard } from '@/components/platform-shell';
import { getAdminAffiliates } from '@/lib/admin-data';
import { AdminAffiliateProfileModal } from '@/components/admin-affiliate-profile-modal';

export const dynamic = 'force-dynamic';

export default async function AdminAffiliatesPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect('/');
  const {data:me}=await supabase.from('profiles').select('full_name,role,status').eq('id',user.id).single();
  if(!me||me.role!=='admin'||me.status!=='active') redirect('/');
  const list = await getAdminAffiliates();
  const active = list.filter(x=>x.status==='active').length;
  const sellers = list.filter(x=>x.sales>0).length;
  const clicks = list.reduce((s,x)=>s+x.clicks,0);
  const sales = list.reduce((s,x)=>s+x.sales,0);
  return <PlatformShell role="admin" name={me.full_name||'Administrador'}>
    <PageHeader eyebrow="AFILIADOS" title="Personas que mueven el negocio" description="Controla el rendimiento, la actividad y la salud de cada afiliado desde un mismo lugar." action={<Link className="native-secondary" href="/admin"><ArrowRight size={15}/> Centro de mando</Link>} />
    <div className="kpi-grid five">
      <KpiCard label="Afiliados" value={String(list.length)} helper={`${active} activos`} accent="blue" />
      <KpiCard label="Con ventas" value={String(sellers)} helper="Afiliados que convierten" accent="green" />
      <KpiCard label="Clicks" value={clicks.toLocaleString('es-VE')} helper="Tracking real" accent="blue" />
      <KpiCard label="Ventas" value={String(sales)} helper="Confirmadas" accent="yellow" />
      <KpiCard label="Actividad" value={list.length ? `${Math.round((sellers/list.length)*100)}%` : '0%'} helper="Afiliados con ventas" accent="red" />
    </div>
    {list.length===0 ? <EmptyState icon={<Users size={22}/>} title="Todavía no hay afiliados" description="Los nuevos registros aparecerán aquí automáticamente."/> : <section className="panel-card table-card admin-table-card"><div className="table-scroll"><table><thead><tr><th>Afiliado</th><th>Estado</th><th>Clicks</th><th>Ventas</th><th>Conversión</th><th>Comisión</th><th></th></tr></thead><tbody>{list.map(a=><tr key={a.id}><td><strong>{a.name}</strong><small>{a.affiliate_code}{a.phone?` · ${a.phone}`:''}</small></td><td><span className={`status ${a.status}`}>{a.status}</span></td><td>{a.clicks}</td><td>{a.sales}</td><td>{a.conversion.toFixed(2)}%</td><td>${a.commission.toFixed(2)}</td><td><AdminAffiliateProfileModal affiliateId={a.id} /></td></tr>)}</tbody></table></div></section>}
  </PlatformShell>;
}
