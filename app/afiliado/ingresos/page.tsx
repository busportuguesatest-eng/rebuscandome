import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, EmptyState, PageHeader, KpiCard } from '@/components/platform-shell';
import { CircleDollarSign, WalletCards, ShieldCheck, AlertTriangle } from 'lucide-react';
import { IncomeActions } from '@/components/income-actions';

export const dynamic = 'force-dynamic';

type PayoutDetails = {
  method?: string; bank_name?: string; account?: string; account_type?: string;
  holder?: string; identifier?: string; phone?: string;
};

function parsePayoutDetails(value: unknown): PayoutDetails {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  return {
    method: typeof raw.method === 'string' ? raw.method : undefined,
    bank_name: typeof raw.bank_name === 'string' ? raw.bank_name : undefined,
    account: typeof raw.account === 'string' ? raw.account : undefined,
    account_type: typeof raw.account_type === 'string' ? raw.account_type : undefined,
    holder: typeof raw.holder === 'string' ? raw.holder : undefined,
    identifier: typeof raw.identifier === 'string' ? raw.identifier : undefined,
    phone: typeof raw.phone === 'string' ? raw.phone : undefined,
  };
}

export default async function AffiliateIncome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name,role,status,onboarding_data')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('[affiliate-income] profile load failed', profileError);
    return <PlatformShell role="affiliate" name={user.email?.split('@')[0] || 'Afiliado'}><PageHeader eyebrow="DINERO" title="Mis ingresos" description="No pudimos cargar tu información financiera en este momento." action={<Link href="/afiliado" className="native-secondary">Volver al inicio</Link>} /><EmptyState icon={<AlertTriangle size={22}/>} title="No pudimos cargar tus ingresos" description="Tu sesión sigue activa. Intenta recargar la página; si el problema continúa, contacta a Soporte." /></PlatformShell>;
  }

  if (!profile || profile.role !== 'affiliate' || profile.status !== 'active') redirect('/');
  const name = profile.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Afiliado';

  const { data: affiliate, error: affiliateError } = await supabase
    .from('affiliates')
    .select('id,status')
    .eq('profile_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (affiliateError || !affiliate) {
    console.error('[affiliate-income] affiliate load failed', affiliateError);
    return <PlatformShell role="affiliate" name={name}><PageHeader eyebrow="DINERO" title="Mis ingresos" description="Tu cuenta está activa, pero todavía estamos preparando el módulo financiero." action={<Link href="/afiliado" className="native-secondary">Volver al inicio</Link>} /><EmptyState icon={<AlertTriangle size={22}/>} title="Tu perfil financiero aún no está listo" description="No hemos podido asociar tu cuenta de afiliado con el módulo de ingresos. Contacta a Soporte para que lo revisemos." action={<Link href="/afiliado/soporte" className="native-primary">Contactar soporte</Link>} /></PlatformShell>;
  }

  const [{ data: commissions }, { data: payouts }] = await Promise.all([
    supabase.from('commissions').select('id,amount,status,created_at,sales(product_id,products(name))').eq('affiliate_id', affiliate.id).order('created_at', { ascending: false }),
    supabase.from('payouts').select('id,amount,method,status,created_at,payout_bank_name,payout_account,payout_account_type,payout_holder,payout_identifier,payout_phone').eq('affiliate_id', affiliate.id).order('created_at', { ascending: false }),
  ]);

  const rows = commissions ?? [];
  const commissionIds = rows.map((x: any) => x.id);
  const { data: allocations } = commissionIds.length
    ? await supabase.from('payout_commission_allocations').select('amount,commission_id').in('commission_id', commissionIds)
    : { data: [] as any[] };

  const allocatedByCommission = new Map<string, number>();
  for (const item of allocations ?? []) allocatedByCommission.set(item.commission_id, (allocatedByCommission.get(item.commission_id) || 0) + Number(item.amount || 0));

  const total = rows.filter((x: any) => x.status !== 'reversed').reduce((n: number, x: any) => n + Number(x.amount || 0), 0);
  const available = Math.max(0, rows.filter((x: any) => x.status === 'available').reduce((n: number, x: any) => n + Math.max(0, Number(x.amount || 0) - (allocatedByCommission.get(x.id) || 0)), 0));
  const paid = rows.filter((x: any) => x.status === 'paid').reduce((n: number, x: any) => n + Number(x.amount || 0), 0);
  const pending = rows.filter((x: any) => x.status === 'pending' || x.status === 'approved').reduce((n: number, x: any) => n + Number(x.amount || 0), 0);
  const payoutDetails = parsePayoutDetails((profile as any).onboarding_data && typeof (profile as any).onboarding_data === 'object' ? ((profile as any).onboarding_data as Record<string, unknown>).payout : undefined);

  return <PlatformShell role="affiliate" name={name}>
    <PageHeader eyebrow="DINERO" title="Mis ingresos" description="Todo tu dinero en un solo lugar: generado, disponible y retirado." action={<Link href="/afiliado/soporte" className="native-secondary"><ShieldCheck size={15}/> Soporte</Link>}/>
    <section className="visual-section-banner income-banner"><div className="visual-section-copy"><span>RESULTADOS</span><h2>Tu actividad se convierte en ingresos.</h2><p>Consulta tus comisiones y deja listo el método donde quieres recibir tus pagos.</p></div></section>
    <div className="kpi-grid four"><KpiCard label="Generado" value={`$${total.toFixed(2)}`} helper="Comisiones no revertidas" accent="yellow"/><KpiCard label="Disponible" value={`$${available.toFixed(2)}`} helper="Listo para solicitar retiro" accent="green"/><KpiCard label="Pendiente" value={`$${pending.toFixed(2)}`} helper="En validación" accent="blue"/><KpiCard label="Pagado" value={`$${paid.toFixed(2)}`} helper="Histórico liquidado"/></div>
    <section className="panel-card income-payment-card"><div className="panel-heading"><div><span className="section-kicker">MÉTODO DE COBRO</span><h2>Configura dónde recibirás tus pagos</h2><p className="panel-subtitle">Guarda tu método de cobro una sola vez. Administración utilizará estos datos cuando apruebe un retiro.</p></div><WalletCards size={18}/></div><IncomeActions available={available} initialDetails={payoutDetails} /></section>
    <div className="dashboard-grid" style={{ marginTop: 16 }}><section className="panel-card"><div className="panel-heading"><div><span className="section-kicker">HISTORIAL</span><h2>Últimas comisiones</h2></div><CircleDollarSign size={18}/></div>{!rows.length?<EmptyState icon={<CircleDollarSign size={20}/>} title="Aún no tienes comisiones" description="Cuando una venta confirmada sea atribuida a tu enlace, aparecerá aquí."/>:<div className="native-list">{rows.slice(0,8).map((x:any)=><div className="native-product" key={x.id}><div><strong>${Number(x.amount).toFixed(2)}</strong><div className="native-muted">{x.sales?.products?.name||'Producto'} · {new Date(x.created_at).toLocaleDateString('es-VE')}</div></div><span className={`status-pill ${x.status}`}>{x.status}</span></div>)}</div>}</section><section className="panel-card"><div className="panel-heading"><div><span className="section-kicker">RETIROS</span><h2>Historial de retiros</h2></div><WalletCards size={18}/></div>{!payouts?.length?<EmptyState icon={<WalletCards size={20}/>} title="Todavía no has solicitado retiros." description="Cuando solicites uno podrás seguir su estado aquí."/>:<div className="native-list">{payouts.map((x:any)=><div className="native-product" key={x.id}><div><strong>${Number(x.amount).toFixed(2)}</strong><div className="native-muted">{x.method} · {new Date(x.created_at).toLocaleDateString('es-VE')}{x.payout_bank_name ? ` · ${x.payout_bank_name}` : ''}</div></div><span className={`status-pill ${x.status}`}>{x.status}</span></div>)}</div>}</section></div>
  </PlatformShell>;
}
