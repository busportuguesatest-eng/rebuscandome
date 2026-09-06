'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PayPalCheckoutButton } from '@/components/paypal-checkout-button';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clipboard,
  Clock3,
  Copy,
  CreditCard,
  FileCheck2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Smartphone,
  UploadCloud,
  UserRound,
  X,
} from 'lucide-react';

type PaymentMethodData = {
  method: string;
  enabled: boolean;
  bank_name: string;
  account: string;
  account_type: string;
  holder: string;
  identifier: string;
  phone: string;
};
type PaymentData = {
  country_code: string;
  paypal: { method: 'paypal'; enabled: boolean };
  pago_movil: PaymentMethodData;
};
type Quote = {
  id: string;
  price_usd: number;
  exchange_rate: number;
  amount_ves: number;
  expires_at: string;
  product: { name: string; short_description?: string | null; cover_url?: string | null };
  payment: PaymentData;
};

const usd = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const ves = (value: number) => new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES', minimumFractionDigits: 2 }).format(value);

function CheckoutClient() {
  const params = useSearchParams();
  const productId = params.get('product_id') ?? '';
  const checkoutCode = params.get('code') ?? '';
  const affiliateId = params.get('affiliate_id');
  const ref = params.get('ref') ?? '';

  const [quote, setQuote] = useState<Quote | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'pago_movil'>('paypal');
  const [paypalPaid, setPaypalPaid] = useState(false);
  const [paypalOrderId, setPaypalOrderId] = useState('');
  const [manualOrderId, setManualOrderId] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState<PaymentMethodData | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptReference, setReceiptReference] = useState('');
  const [receiptSent, setReceiptSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState('');

  const loadQuote = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/checkout/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId || undefined,
          checkout_code: checkoutCode || undefined,
          affiliate_id: affiliateId || undefined,
          ref: ref || undefined,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.message || 'No pudimos preparar tu compra.');
      setQuote(body.quote);
      const nextMethod = body.quote.payment?.paypal?.enabled ? 'paypal' : (body.quote.payment?.pago_movil?.enabled ? 'pago_movil' : 'paypal');
      setPaymentMethod(nextMethod);
      setSecondsLeft(Math.max(0, Math.floor((Date.parse(body.quote.expires_at) - Date.now()) / 1000)));
    } catch (err) {
      setQuote(null);
      setError(err instanceof Error ? err.message : 'No pudimos preparar tu compra.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (productId || checkoutCode) void loadQuote();
    else {
      setError('Falta el código del producto.');
      setLoading(false);
    }
  }, [productId, checkoutCode, affiliateId, ref]);

  useEffect(() => {
    if (!quote || paymentMethod === 'paypal') return;
    const timer = window.setInterval(() => {
      setSecondsLeft(Math.max(0, Math.floor((Date.parse(quote.expires_at) - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [quote]);

  const timer = useMemo(
    () => `${Math.floor(secondsLeft / 60).toString().padStart(2, '0')}:${(secondsLeft % 60).toString().padStart(2, '0')}`,
    [secondsLeft],
  );

  const selectedPayment = paymentMethod === 'pago_movil' ? quote?.payment?.pago_movil : null;
  const paymentReady = paymentMethod === 'paypal'
    ? Boolean(quote?.payment?.paypal?.enabled)
    : Boolean(selectedPayment?.enabled && selectedPayment.bank_name && selectedPayment.phone && selectedPayment.identifier);
  const customerReady = Boolean(name.trim() && email.trim());

  const copyValue = async (key: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(''), 1600);
    } catch {
      setError('No pudimos copiar el dato automáticamente.');
    }
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!quote) return;
    if (secondsLeft <= 0) {
      await loadQuote();
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/checkout/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote_id: quote.id,
          payment_method: paymentMethod,
          customer_email: email,
          customer_name: name,
          customer_phone: phone,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.message || 'No pudimos registrar tu pedido.');
      setManualOrderId(body.order_id);
      setPaymentInstructions(body.instructions ?? selectedPayment ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos registrar tu pedido.');
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReceipt(event: FormEvent) {
    event.preventDefault();
    if (!manualOrderId || !receipt || !receiptReference.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const form = new FormData();
      form.set('order_id', manualOrderId);
      form.set('payment_reference', receiptReference.trim());
      form.set('receipt', receipt);
      const response = await fetch('/api/checkout/receipt', { method: 'POST', body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.message || 'No pudimos recibir el comprobante.');
      setReceiptSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos recibir el comprobante.');
    } finally {
      setSubmitting(false);
    }
  }

  const formatBank = (data: PaymentMethodData | null) => {
    if (!data) return [] as Array<[string, string, string]>;
    const rows: Array<[string, string, string]> = [['Banco', data.bank_name, 'bank']];
    if (data.identifier) rows.push(['Cédula / RIF', data.identifier, 'identifier']);
    if (data.phone) rows.push(['Teléfono', data.phone, 'phone']);
    return rows;
  };


  if (loading) {
    return <main className="checkout-v2-page"><div className="checkout-v2-shell"><div className="checkout-v2-loading"><div className="checkout-v2-logo">R</div><strong>Preparando tu compra</strong><span>Estamos calculando el total y preparando los datos de pago.</span></div></div></main>;
  }

  if (!quote) {
    return <main className="checkout-v2-page"><div className="checkout-v2-shell"><section className="checkout-v2-error"><div className="checkout-v2-error-icon"><X size={26}/></div><span className="checkout-v2-kicker">CHECKOUT</span><h1>No pudimos preparar tu compra</h1><p>{error || 'El producto no está disponible en este momento.'}</p><button type="button" className="checkout-v2-primary" onClick={() => void loadQuote()}>Intentar nuevamente <ArrowRight size={16}/></button></section></div></main>;
  }

  return (
    <main className="checkout-v2-page">
      <div className="checkout-v2-shell">
        <header className="checkout-v2-header">
          <div className="checkout-v2-brand"><div className="checkout-v2-logo">R</div><div><span>REBUSCÁNDOME</span><strong>Checkout seguro</strong></div></div>
          <div className="checkout-v2-header-right"><span><ShieldCheck size={15}/> Compra protegida</span><span><LockKeyhole size={15}/> Datos cifrados</span></div>
        </header>

        <div className="checkout-v2-progress"><div className="checkout-v2-progress-item active"><span>1</span><div><strong>Datos</strong><small>Tu información</small></div></div><i/><div className={`checkout-v2-progress-item ${manualOrderId ? 'active' : ''}`}><span>2</span><div><strong>Pago</strong><small>Método elegido</small></div></div><i/><div className={`checkout-v2-progress-item ${receiptSent ? 'active' : ''}`}><span>3</span><div><strong>Comprobante</strong><small>Último paso</small></div></div></div>

        <div className="checkout-v2-grid">
          <aside className="checkout-v2-summary">
            <div className="checkout-v2-product-image">{quote.product.cover_url ? <img src={quote.product.cover_url} alt=""/> : <div>R</div>}<span>PRODUCTO DIGITAL</span></div>
            <div className="checkout-v2-summary-copy"><span className="checkout-v2-kicker">TU COMPRA</span><h1>{quote.product.name}</h1><p>{quote.product.short_description || 'Producto digital de Rebuscándome.'}</p></div>
            <div className="checkout-v2-price"><div><span>Precio</span><strong>{usd(quote.price_usd)}</strong></div><div><span>Total estimado</span><strong>{ves(quote.amount_ves)}</strong></div></div>
            <div className={`checkout-v2-timer ${secondsLeft < 120 ? 'urgent' : ''}`}><Clock3 size={16}/><div><span>Cotización reservada</span><strong>{timer}</strong></div><small>Actualiza al vencer</small></div>
            <div className="checkout-v2-trust"><div><ShieldCheck size={16}/><div><strong>{paymentMethod === 'paypal' ? 'Pago automatizado' : 'Revisión manual'}</strong><span>{paymentMethod === 'paypal' ? 'PayPal confirma el pago y activa el acceso.' : 'Tu pago es verificado por nuestro equipo.'}</span></div></div><div><Mail size={16}/><div><strong>Entrega por correo</strong><span>Recibirás el acceso privado después de confirmar el pago.</span></div></div><div><LockKeyhole size={16}/><div><strong>Acceso privado</strong><span>Los archivos no quedan públicos.</span></div></div></div>
          </aside>

          <section className="checkout-v2-card">
            {error && <div className="checkout-v2-alert"><X size={15}/>{error}</div>}
            {!manualOrderId ? (
              <form onSubmit={submit} className="checkout-v2-form">
                <div className="checkout-v2-section-head"><span>01</span><div><strong>¿A dónde enviamos tu acceso?</strong><small>Usaremos estos datos para identificar la compra y enviarte el producto.</small></div></div>
                <div className="checkout-v2-fields"><label><span><UserRound size={13}/> Nombre completo</span><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre y apellido"/></label><label><span><Mail size={13}/> Correo electrónico</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com"/></label><label className="full"><span><Smartphone size={13}/> Teléfono <em>opcional</em></span><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0412 0000000"/></label></div>

                <div className="checkout-v2-section-head payment-head"><span>02</span><div><strong>Elige tu método de pago</strong><small>Los datos de pago cambian automáticamente.</small></div></div>
                <div className="checkout-v2-methods"><button type="button" className={paymentMethod === 'paypal' ? 'active' : ''} onClick={() => setPaymentMethod('paypal')} disabled={!quote.payment.paypal.enabled}><span className="method-icon paypal"><CreditCard size={19}/></span><div><strong>PayPal</strong><small>Pago seguro en USD</small></div>{paymentMethod === 'paypal' && <CheckCircle2 size={18}/>}</button>{quote.payment.pago_movil.enabled && <button type="button" className={paymentMethod === 'pago_movil' ? 'active' : ''} onClick={() => setPaymentMethod('pago_movil')}><span className="method-icon mobile"><Smartphone size={19}/></span><div><strong>Pago Móvil</strong><small>Disponible para Venezuela</small></div>{paymentMethod === 'pago_movil' && <CheckCircle2 size={18}/>}</button>}</div>

                {paymentMethod === 'paypal' ? <div className="checkout-v2-paypal-card"><div className="checkout-v2-bank-head"><div className="checkout-v2-bank-icon"><CreditCard size={17}/></div><div><span>PAGO INTERNACIONAL</span><strong>PayPal</strong></div><div className="checkout-v2-verified"><ShieldCheck size={13}/> Seguro</div></div><div className="checkout-v2-paypal-copy"><strong>Paga en dólares con PayPal.</strong><span>Tu pago se procesa directamente con PayPal y la orden se confirma automáticamente.</span></div><div className="checkout-v2-amount"><span>Total a pagar</span><strong>{usd(quote.price_usd)}</strong><small>No necesitas realizar una transferencia manual.</small></div><PayPalCheckoutButton quoteId={quote.id} name={name} email={email} phone={phone} ready={customerReady} onBusy={setSubmitting} onError={setError} onSuccess={(result)=>{setPaypalPaid(true);setPaypalOrderId(result.order_id);setManualOrderId(result.order_id);}}/></div> : <div className="checkout-v2-bank-card"><div className="checkout-v2-bank-head"><div className="checkout-v2-bank-icon"><Smartphone size={17}/></div><div><span>DATOS PARA REALIZAR EL PAGO</span><strong>Pago Móvil</strong></div><div className="checkout-v2-verified"><ShieldCheck size={13}/> Verificado</div></div>{paymentReady ? <div className="checkout-v2-bank-rows">{formatBank(selectedPayment ?? null).map(([label, value, key]) => <div key={key}><div><span>{label}</span><strong>{value}</strong></div><button type="button" aria-label={`Copiar ${label}`} onClick={() => void copyValue(key, value)}>{copied === key ? <Check size={14}/> : <Copy size={14}/>}</button></div>)}</div> : <div className="checkout-v2-bank-disabled"><FileCheck2 size={18}/><div><strong>Pago Móvil no está disponible.</strong><span>Selecciona PayPal o intenta nuevamente más tarde.</span></div></div>}<div className="checkout-v2-amount"><span>Monto exacto a pagar</span><strong>{ves(quote.amount_ves)}</strong><small>Se calcula con la cotización vigente mostrada arriba.</small></div></div>}

{paymentMethod === 'pago_movil' && <label className="checkout-v2-ack"><input type="checkbox" required/><span>Confirmo que revisaré estos datos y realizaré el pago por el monto exacto indicado.</span></label>}
                {paymentMethod === 'pago_movil' && <button type="submit" className="checkout-v2-primary checkout-v2-submit" disabled={submitting || secondsLeft <= 0 || !paymentReady}>{submitting ? 'Preparando pedido…' : 'Continuar con mi pedido'} <ArrowRight size={17}/></button>}
                <p className="checkout-v2-note"><LockKeyhole size={13}/> {paymentMethod === 'paypal' ? 'PayPal confirma el pago de forma automática y habilita la entrega.' : 'No se genera la venta ni la comisión hasta que el equipo confirme tu pago.'}</p>
              </form>
            ) : paypalPaid ? (<div className="checkout-v2-success"><div className="checkout-v2-success-icon"><CheckCircle2 size={30}/></div><span className="checkout-v2-kicker">PAGO CONFIRMADO</span><h2>¡Compra completada!</h2><p>Tu pago con PayPal fue confirmado. Hemos generado tu acceso privado y enviado las instrucciones al correo <strong>{email}</strong>.</p><div className="checkout-v2-order"><span>ORDEN PAYPAL</span><strong>{paypalOrderId}</strong></div><div className="checkout-v2-success-grid"><div><ShieldCheck size={16}/><strong>Pago confirmado</strong><span>PayPal procesó la operación</span></div><div><Mail size={16}/><strong>Acceso enviado</strong><span>Revisa tu correo y spam</span></div></div></div>) : receiptSent ? (
              <div className="checkout-v2-success"><div className="checkout-v2-success-icon"><CheckCircle2 size={30}/></div><span className="checkout-v2-kicker">COMPROBANTE RECIBIDO</span><h2>Tu compra quedó en revisión</h2><p>Hemos recibido tu comprobante. Cuando el pago sea confirmado, recibirás el acceso privado del producto en <strong>{email}</strong>.</p><div className="checkout-v2-order"><span>NÚMERO DE PEDIDO</span><strong>{manualOrderId}</strong></div><div className="checkout-v2-success-grid"><div><ShieldCheck size={16}/><strong>Pago en revisión</strong><span>Verificado manualmente</span></div><div><Mail size={16}/><strong>Entrega automática</strong><span>Enviaremos el acceso al correo</span></div></div></div>
            ) : (
              <form onSubmit={sendReceipt} className="checkout-v2-form">
                <div className="checkout-v2-section-head"><span>03</span><div><strong>Completa el comprobante</strong><small>Haz el pago con los datos anteriores y sube el comprobante.</small></div></div>
                <div className="checkout-v2-payment-summary"><div><span>Pedido</span><strong>{manualOrderId}</strong></div><div><span>Método</span><strong>Pago Móvil</strong></div><div><span>Monto</span><strong>{ves(quote.amount_ves)}</strong></div></div>
                <div className="checkout-v2-instructions"><div className="checkout-v2-instructions-head"><CreditCard size={17}/><div><span>REFERENCIA DE PAGO</span><strong>Conserva el comprobante hasta recibir tu acceso</strong></div></div><div className="checkout-v2-mini-bank">{paymentInstructions?.bank_name && <div><span>Banco</span><strong>{paymentInstructions.bank_name}</strong></div>}{paymentMethod === 'pago_movil' && paymentInstructions?.phone && <div><span>Teléfono</span><strong>{paymentInstructions.phone}</strong></div>}{paymentInstructions?.account && <div><span>Cuenta</span><strong>{paymentInstructions.account}</strong></div>}</div></div>
                <label className="checkout-v2-upload"><span><Clipboard size={15}/> Referencia de pago</span><input required value={receiptReference} onChange={(e) => setReceiptReference(e.target.value)} placeholder="Número de referencia o comprobante"/></label>
                <label className="checkout-v2-file"><UploadCloud size={24}/><div><strong>{receipt ? receipt.name : 'Sube tu comprobante'}</strong><span>PDF, JPG, PNG o WEBP · máximo 10 MB</span></div><input required type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}/></label>
                <button type="submit" className="checkout-v2-primary" disabled={submitting || !receipt || !receiptReference.trim()}>{submitting ? 'Enviando comprobante…' : 'Enviar comprobante'} <ArrowRight size={17}/></button>
                <p className="checkout-v2-note"><ShieldCheck size={13}/> Tu comprobante se guarda en almacenamiento privado y solo lo revisa el equipo autorizado.</p>
              </form>
            )}
          </section>
        </div>

        <footer className="checkout-v2-footer"><span>Rebuscándome</span><span>Pago PayPal o Pago Móvil con revisión administrativa</span><span><LockKeyhole size={12}/> Proceso protegido</span></footer>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return <Suspense fallback={<main className="checkout-v2-page"><div className="checkout-v2-shell"><div className="checkout-v2-loading"><div className="checkout-v2-logo">R</div><strong>Preparando checkout</strong><span>Un momento…</span></div></div></main>}><CheckoutClient/></Suspense>;
}
