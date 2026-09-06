import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, CircleDollarSign, ReceiptText, TrendingUp, WalletCards } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, EmptyState, PageHeader, KpiCard } from '@/components/platform-shell';
import { AdminPayoutActions } from '@/components/admin-payout-actions';
import { ManualPaymentReview } from '@/components/manual-payment-review';

export const dynamic='force-dynamic';

function relation<T>(value:T|T[]|null|undefined):T|null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }

export default async function AdminFinancePage(){
  const s=await createClient();
  const {data:{user}}=await s.auth.getUser(); if(!user)redirect('/');
  const {data:me}=await s.from('profiles').select('full_name,role,status').eq('id',user.id).single(); if(!me||me.role!=='admin'||me.status!=='active')redirect('/');

  const [{data:sales},{data:commissions},{data:payouts}]=await Promise.all([
    s.from('sales').select('id,gross_amount,commission_amount,currency,status,confirmed_at,created_at,products(name),affiliates(affiliate_code,profiles(full_name))').order('created_at',{ascending:false}).limit(100),
    s.from('commissions').select('id,amount,status,created_at,affiliates(affiliate_code,profiles(full_name))').order('created_at',{ascending:false}).limit(100),
    s.from('payouts').select('id,amount,method,status,created_at,payout_channel,payout_bank_name,payout_account,payout_account_type,payout_holder,payout_identifier,payout_phone,affiliates(affiliate_code,profiles(full_name))').order('created_at',{ascending:false}).limit(100),
  ]);

  const confirmed=(sales??[]).filter((x:any)=>x.status==='confirmed');
  const revenue=confirmed.reduce((n:number,r:any)=>n+Number(r.gross_amount||0),0);
  const commission=(commissions??[]).filter((x:any)=>x.status!=='reversed').reduce((n:number,r:any)=>n+Number(r.amount||0),0);
  const openPayouts=(payouts??[]).filter((p:any)=>['requested','review','approved','processing'].includes(p.status));
  const payoutTotal=openPayouts.reduce((n:number,r:any)=>n+Number(r.amount||0),0);

  return <PlatformShell role="admin" name={me.full_name||'Administrador'}>
    <PageHeader eyebrow="VENTAS & FINANZAS" title="Centro financiero" description="Controla pagos, ventas, comisiones y retiros desde una vista operativa clara." action={<Link className="native-secondary" href="/admin"><ArrowRight size={15}/> Centro de mando</Link>}/>

    <div className="kpi-grid four"><KpiCard label="Facturación" value={`$${revenue.toFixed(2)}`} helper="Ventas confirmadas" accent="yellow"/><KpiCard label="Comisiones" value={`$${commission.toFixed(2)}`} helper="Generadas" accent="blue"/><KpiCard label="Retiros abiertos" value={String(openPayouts.length)} helper="Pendientes de gestión" accent="red"/><KpiCard label="Monto en retiros" value={`$${payoutTotal.toFixed(2)}`} helper="Solicitudes abiertas" accent="green"/></div>

    <ManualPaymentReview/>

    <div className="finance-section-nav">
      <a href="#ventas"><ReceiptText size={15}/> Ventas <span>{sales?.length ?? 0}</span></a>
      <a href="#comisiones"><TrendingUp size={15}/> Comisiones <span>{commissions?.length ?? 0}</span></a>
      <a href="#retiros"><WalletCards size={15}/> Retiros <span>{payouts?.length ?? 0}</span></a>
    </div>

    <section id="ventas" className="panel-card finance-ledger-card">
      <div className="panel-heading"><div><span className="section-kicker">VENTAS</span><h2>Últimas transacciones</h2><p className="panel-subtitle">Registro de ventas procesadas por la plataforma.</p></div><ReceiptText size={18}/></div>
      {!sales?.length?<EmptyState icon={<CircleDollarSign size={20}/>} title="Sin ventas todavía" description="Cuando una venta real se confirme aparecerá aquí."/>:<div className="table-scroll"><table className="finance-table"><thead><tr><th>Producto</th><th>Afiliado</th><th>Monto</th><th>Comisión</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>{sales.map((r:any)=>{ const affiliate=relation(r.affiliates); const profile=relation((affiliate as any)?.profiles); return <tr key={r.id}><td><strong>{relation(r.products)?.name||'Producto'}</strong><small>Venta #{String(r.id).slice(0,8)}</small></td><td>{(profile as any)?.full_name||(affiliate as any)?.affiliate_code||'Directa'}</td><td><strong>${Number(r.gross_amount).toFixed(2)}</strong></td><td>${Number(r.commission_amount).toFixed(2)}</td><td><span className={`status ${r.status}`}>{r.status}</span></td><td>{r.confirmed_at?new Date(r.confirmed_at).toLocaleDateString('es-VE'):'—'}</td></tr>})}</tbody></table></div>}
    </section>

    <section id="comisiones" className="panel-card finance-ledger-card" style={{marginTop:16}}>
      <div className="panel-heading"><div><span className="section-kicker">COMISIONES</span><h2>Movimientos de afiliados</h2><p className="panel-subtitle">Comisiones generadas a partir de ventas confirmadas.</p></div><TrendingUp size={18}/></div>
      {!commissions?.length?<EmptyState icon={<CircleDollarSign size={20}/>} title="Sin comisiones" description="Aparecerán al confirmarse las ventas."/>:<div className="table-scroll"><table className="finance-table"><thead><tr><th>Afiliado</th><th>Monto</th><th>Estado</th><th>Fecha</th><th>Acción</th></tr></thead><tbody>{commissions.map((r:any)=>{ const affiliate=relation(r.affiliates); const profile=relation((affiliate as any)?.profiles); return <tr key={r.id}><td><strong>{(profile as any)?.full_name||(affiliate as any)?.affiliate_code||'Afiliado'}</strong></td><td><strong>${Number(r.amount).toFixed(2)}</strong></td><td><span className={`status ${r.status}`}>{r.status}</span></td><td>{new Date(r.created_at).toLocaleDateString('es-VE')}</td><td><AdminPayoutActions id={r.id} status={r.status}/></td></tr>})}</tbody></table></div>}
    </section>

    <section id="retiros" className="panel-card finance-ledger-card" style={{marginTop:16}}>
      <div className="panel-heading"><div><span className="section-kicker">RETIROS</span><h2>Solicitudes de retiro</h2><p className="panel-subtitle">Revisa el estado y procesa las solicitudes de los afiliados.</p></div><WalletCards size={18}/></div>
      {!payouts?.length?<EmptyState icon={<WalletCards size={20}/>} title="Sin solicitudes" description="Las solicitudes reales de los afiliados aparecerán aquí."/>:<div className="table-scroll"><table className="finance-table"><thead><tr><th>Afiliado</th><th>Monto</th><th>Destino</th><th>Estado</th><th>Fecha</th><th>Acción</th></tr></thead><tbody>{payouts.map((r:any)=>{ const affiliate=relation(r.affiliates); const profile=relation((affiliate as any)?.profiles); return <tr key={r.id}><td><strong>{(profile as any)?.full_name||(affiliate as any)?.affiliate_code||'Afiliado'}</strong></td><td><strong>${Number(r.amount).toFixed(2)}</strong></td><td><strong>{r.payout_channel==='transferencia'?'Transferencia':'Pago Móvil'}</strong><small>{r.payout_bank_name||'Banco no registrado'} · {r.payout_account||r.payout_phone||'—'}</small><small>{r.payout_holder||'Sin titular'} · {r.payout_identifier||'—'}</small></td><td><span className={`status ${r.status}`}>{r.status}</span></td><td>{new Date(r.created_at).toLocaleDateString('es-VE')}</td><td><AdminPayoutActions id={r.id} status={r.status}/></td></tr>})}</tbody></table></div>}
    </section>
  </PlatformShell>;
}
