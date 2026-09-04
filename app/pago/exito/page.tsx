import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/service';
import { PaymentStatusRefresh } from '@/components/payment-status-refresh';

export const dynamic = 'force-dynamic';

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default async function PagoExitoPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const params = await searchParams;
  const orderId = typeof params.order === 'string' ? params.order.trim() : '';

  let status: 'paid' | 'pending' | 'cancelled' | 'failed' | 'missing' = 'missing';
  let productName = '';
  let productId = '';
  let affiliateId = '';

  if (validUuid(orderId)) {
    try {
      const service = createServiceClient();
      const { data: order } = await service
        .from('orders')
        .select('status,product_id,affiliate_id,products(name)')
        .eq('id', orderId)
        .maybeSingle();

      if (order) {
        status = order.status === 'paid' || order.status === 'pending' || order.status === 'cancelled' || order.status === 'failed'
          ? order.status
          : 'missing';
        productId = typeof order.product_id === 'string' ? order.product_id : '';
        affiliateId = typeof order.affiliate_id === 'string' ? order.affiliate_id : '';
        const product = Array.isArray(order.products) ? order.products[0] : order.products;
        productName = product && typeof product === 'object' && 'name' in product ? String(product.name) : '';
      }
    } catch {
      status = 'pending';
    }
  }

  const paid = status === 'paid';
  const terminal = status === 'cancelled' || status === 'failed' || status === 'missing';
  const title = paid ? '¡Pago confirmado!' : terminal ? 'No pudimos confirmar la compra' : 'Estamos confirmando tu pago';
  const message = paid
    ? 'La transacción fue confirmada por nuestro servidor. Tu compra ya quedó registrada.'
    : terminal
      ? 'Verifica el número de orden o vuelve al checkout para intentar nuevamente.'
      : 'El proveedor puede tardar unos segundos en notificar la transacción. No cierres esta página; verificaremos nuevamente.';

  return (
    <main className="payment-result-page visual-success-page">
      <div className={`payment-result-card ${paid ? 'is-paid' : terminal ? 'is-error' : 'is-pending'}`}>
        <div className="payment-result-badge">Rebuscándome</div>
        <div className="payment-result-icon" aria-hidden="true">{paid ? '✓' : terminal ? '!' : '…'}</div>
        <p className="payment-result-kicker">Estado de la compra</p>
        <h1>{title}</h1>
        {productName && <p className="payment-result-product">{productName}</p>}
        <p className="payment-result-copy">{message}</p>

        {orderId && <div className="payment-order-box"><span>Orden</span><strong>{orderId}</strong></div>}

        {!terminal && <PaymentStatusRefresh orderId={orderId} enabled={!paid} />}

        <div className="payment-result-actions">
          <Link href="/" className="payment-secondary-link">Volver a Rebuscándome</Link>
          {terminal && <Link href={productId ? `/checkout?product_id=${encodeURIComponent(productId)}${affiliateId ? `&affiliate_id=${encodeURIComponent(affiliateId)}` : ''}` : '/'} className="payment-primary-link">Volver al checkout</Link>}
        </div>
      </div>
    </main>
  );
}
