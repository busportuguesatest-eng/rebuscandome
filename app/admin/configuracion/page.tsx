import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CircleDollarSign, Database, ExternalLink, Gauge, KeyRound, LifeBuoy, ShieldCheck, Users } from 'lucide-react';
import { PaymentMethodSettings } from '@/components/payment-method-settings';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, PageHeader } from '@/components/platform-shell';
export const dynamic='force-dynamic';
export default async function Page(){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/');
 const {data:me}=await supabase.from('profiles').select('full_name,role,status').eq('id',user.id).single(); if(!me||me.role!=='admin'||me.status!=='active') redirect('/');
 const [{count:affiliates},{count:products},{count:activeProducts},{count:pendingPayouts}] = await Promise.all([
  supabase.from('affiliates').select('id',{count:'exact',head:true}), supabase.from('products').select('id',{count:'exact',head:true}), supabase.from('products').select('id',{count:'exact',head:true}).eq('status','active'), supabase.from('payouts').select('id',{count:'exact',head:true}).in('status',['requested','review','approved','processing'])
 ]);
 return <PlatformShell role="admin" name={me.full_name||'Administrador'}>
  <PageHeader eyebrow="ADMINISTRACIÓN" title="Configuración" description="Controles esenciales para operar Rebuscándome sin entrar en pantallas técnicas."/>
  <section className="settings-hero visual-admin-settings"><div><span className="section-kicker light">CENTRO DE OPERACIONES</span><h2>Tu plataforma, bajo control.</h2><p>Revisa el estado del catálogo, afiliados, pagos y conexiones principales desde este espacio.</p></div><div className="settings-health"><Gauge size={18}/><div><strong>Operación normal</strong><span>Supabase conectado · datos reales</span></div></div></section>
  <section className="payment-settings-wrap"><div className="panel-heading"><div><span className="section-kicker">CHECKOUT</span><h2>Métodos de pago manual</h2><p className="panel-subtitle">Configura una vez los datos que verá el cliente en Pago Móvil o Transferencia.</p></div></div><PaymentMethodSettings /></section>
  <div className="settings-grid">
   <section className="panel-card settings-card"><div className="settings-card-icon blue"><Database size={18}/></div><span className="section-kicker">CATÁLOGO</span><h3>Productos</h3><p>{products||0} registrados · {activeProducts||0} activos.</p><Link href="/admin/productos" className="ghost-link">Administrar productos <ExternalLink size={14}/></Link></section>
   <section className="panel-card settings-card"><div className="settings-card-icon green"><Users size={18}/></div><span className="section-kicker">RED</span><h3>Afiliados</h3><p>{affiliates||0} perfiles. El catálogo activo se asigna automáticamente.</p><Link href="/admin/afiliados" className="ghost-link">Ver afiliados <ExternalLink size={14}/></Link></section>
   <section className="panel-card settings-card"><div className="settings-card-icon yellow"><CircleDollarSign size={18}/></div><span className="section-kicker">FINANZAS</span><h3>Pagos y retiros</h3><p>{pendingPayouts||0} solicitudes pendientes.</p><Link href="/admin/finanzas" className="ghost-link">Ver finanzas <ExternalLink size={14}/></Link></section>
   <section className="panel-card settings-card"><div className="settings-card-icon red"><ShieldCheck size={18}/></div><span className="section-kicker">SEGURIDAD</span><h3>Acceso</h3><p>Autenticación Supabase activa. CAPTCHA está desactivado en esta V1.</p><Link href="/recuperar" className="ghost-link">Recuperación de cuenta <ExternalLink size={14}/></Link></section>
   <section className="panel-card settings-wide"><div className="panel-heading"><div><span className="section-kicker">CONEXIONES</span><h2>Servicios activos</h2></div><KeyRound size={18}/></div><div className="settings-status-list"><div><span>Base de datos</span><strong>Supabase · Conectado</strong></div><div><span>Checkout</span><strong>PagoFlash · Configurado</strong></div><div><span>Tasa USD/VES</span><strong>Motor dinámico · 15 min</strong></div><div><span>Tracking</span><strong>Enlaces y atribución activos</strong></div></div></section>
   <section className="panel-card settings-wide"><div className="panel-heading"><div><span className="section-kicker">OPERACIÓN</span><h2>Accesos rápidos</h2></div><LifeBuoy size={18}/></div><div className="settings-actions"><Link href="/admin/productos/nuevo" className="native-primary">Crear producto</Link><Link href="/admin/formacion/recursos" className="native-secondary">Gestionar recursos</Link><Link href="/admin/finanzas#retiros" className="native-secondary">Gestionar retiros</Link></div></section>
  </div>
 </PlatformShell>
}
