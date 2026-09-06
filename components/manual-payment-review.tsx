'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, CircleX, FileText, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';

type ManualOrder = {
  id: string;
  amount_usd: number | string;
  amount_ves: number | string;
  exchange_rate: number | string;
  payment_method: string | null;
  payment_reference: string | null;
  created_at: string;
  customers?: { name?: string | null; email?: string | null } | { name?: string | null; email?: string | null }[] | null;
  products?: { name?: string | null } | { name?: string | null }[] | null;
  affiliates?: { affiliate_code?: string | null; profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null } | { affiliate_code?: string | null; profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null }[] | null;
  receipt?: { id: string; original_name?: string | null; mime_type?: string | null; file_size?: number | null; created_at: string; receipt_url?: string | null } | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function moneyUsd(value: number | string) { return `$${Number(value).toFixed(2)}`; }
function moneyVes(value: number | string) { return `Bs. ${Number(value).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export function ManualPaymentReview() {
  const [orders, setOrders] = useState<ManualOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/admin/manual-payments', { cache: 'no-store' });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body.ok) throw new Error(body.message || 'No se pudieron cargar los pagos.');
      setOrders(body.orders ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar los pagos.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function action(order: ManualOrder, actionName: 'confirm' | 'reject') {
    if (actionName === 'reject' && !window.confirm('¿Seguro que deseas rechazar este pago? La orden dejará de estar pendiente.')) return;
    if (actionName === 'confirm' && !window.confirm(`¿Confirmar el pago de ${moneyVes(order.amount_ves)}? Esto generará la venta, comisión y acceso del comprador.`)) return;

    setBusy(order.id); setError(''); setNotice('');
    try {
      const r = await fetch('/api/admin/manual-payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          action: actionName,
          reference: order.payment_reference || null,
          reason: actionName === 'reject' ? 'Comprobante/pago no verificado' : null,
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body.ok) throw new Error(body.message || 'No se pudo procesar la solicitud.');
      if (actionName === 'confirm') {
        setNotice(`Venta confirmada correctamente.${body.email?.sent ? ' El correo de acceso fue enviado.' : ' El acceso fue generado; revisa la configuración de correo si no se envió.'}`);
      } else {
        setNotice('Pago rechazado correctamente.');
      }
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo procesar la solicitud.'); }
    finally { setBusy(''); }
  }

  return <section className="panel-card manual-payment-review" style={{ marginTop: 16 }}>
    <div className="panel-heading manual-payment-heading">
      <div><span className="section-kicker">PAGO MANUAL</span><h2>Verificación de pagos</h2><p className="panel-subtitle">Confirma únicamente después de validar monto, referencia y comprobante en el banco.</p></div>
      <button className="icon-action" onClick={() => void load()} title="Actualizar" aria-label="Actualizar"><RefreshCw size={16}/></button>
    </div>

    <div className="manual-payment-security"><ShieldCheck size={17}/><span><strong>Confirmación protegida.</strong> Al aprobar se crea la venta, la comisión y el acceso privado del comprador.</span></div>
    {error && <div className="native-error small">{error}</div>}
    {notice && <div className="native-success manual-payment-notice"><CheckCircle2 size={16}/>{notice}</div>}

    {loading ? <div className="checkout-state"><Loader2 size={18} className="spin"/> Cargando pagos…</div> : !orders.length ? <div className="finance-empty-state"><CheckCircle2 size={22}/><div><strong>Todo al día</strong><p>No hay pagos manuales pendientes de revisión.</p></div></div> : <div className="manual-payment-grid">{orders.map(order => {
      const customer = one(order.customers); const product = one(order.products); const affiliate = one(order.affiliates); const profile = one(affiliate?.profiles);
      const busyThis = busy === order.id;
      return <article className="manual-payment-card" key={order.id}>
        <div className="manual-payment-card-top">
          <div><span className="status pending">Pendiente</span><small>{new Date(order.created_at).toLocaleString('es-VE')}</small></div>
          <div className="manual-payment-amount"><strong>{moneyVes(order.amount_ves)}</strong><span>{moneyUsd(order.amount_usd)}</span></div>
        </div>
        <div className="manual-payment-main">
          <div><span>Cliente</span><strong>{customer?.name || 'Cliente'}</strong><small>{customer?.email || 'Sin correo'}</small></div>
          <div><span>Producto</span><strong>{product?.name || 'Producto'}</strong><small>{profile?.full_name || affiliate?.affiliate_code || 'Venta directa'}</small></div>
          <div><span>Método</span><strong>{order.payment_method === 'pago_movil' ? 'Pago Móvil' : 'Transferencia'}</strong><small>Tasa Bs. {Number(order.exchange_rate).toLocaleString('es-VE')}</small></div>
          <div><span>Referencia</span><strong>{order.payment_reference || 'Sin referencia'}</strong><small>{order.receipt ? 'Comprobante recibido' : 'Sin comprobante'}</small></div>
        </div>
        <div className="manual-payment-receipt">
          <FileText size={18}/>
          <div><strong>{order.receipt?.original_name || 'Comprobante no adjunto'}</strong><span>{order.receipt?.file_size ? `${Math.max(1, Math.round(order.receipt.file_size / 1024))} KB` : 'Solicita el comprobante antes de verificar'}</span></div>
          {order.receipt?.receipt_url ? <a href={order.receipt.receipt_url} target="_blank" rel="noreferrer" className="payment-secondary-link">Abrir</a> : null}
        </div>
        <div className="manual-payment-actions">
          <button className="native-secondary" disabled={busyThis} onClick={() => void action(order, 'reject')}><CircleX size={14}/> Rechazar</button>
          <button className="native-primary" disabled={busyThis} onClick={() => void action(order, 'confirm')}>{busyThis ? <Loader2 size={14} className="spin"/> : <CheckCircle2 size={14}/>} Confirmar pago</button>
        </div>
      </article>;
    })}</div>}
  </section>;
}
