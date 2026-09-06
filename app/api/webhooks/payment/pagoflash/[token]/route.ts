import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

type FinalizedPayment = { sale_id: string; commission_id: string | null };

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function normalizeStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const expectedToken = process.env.PAGOFLASH_WEBHOOK_TOKEN?.trim() || '';
  const { token } = await context.params;
  if (!expectedToken || !constantTimeEqual(token, expectedToken)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });

  const payload = body as Record<string, unknown>;
  const orderId = payload.orderId;
  const providerOrderId = payload.id;
  const status = normalizeStatus(payload.status);
  const amountPaid = Number(payload.amountPaid ?? payload.payAmount);
  const paidAt = payload.paidAt == null ? null : new Date(String(payload.paidAt));

  if (!validUuid(orderId) || typeof providerOrderId !== 'string' || !providerOrderId.trim()) {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
  }

  if (paidAt && Number.isNaN(paidAt.getTime())) return NextResponse.json({ error: 'INVALID_PAID_AT' }, { status: 400 });

  if (status !== 'pagada') {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const supabase = createServiceClient();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id,product_id,affiliate_id,amount,amount_usd,amount_ves,currency,payment_provider,provider_order_id,status')
      .eq('id', orderId)
      .eq('payment_provider', 'pagoflash')
      .eq('provider_order_id', providerOrderId.trim())
      .maybeSingle();

    if (orderError || !order) return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 });
    if (order.status === 'paid') return NextResponse.json({ ok: true, duplicate: true });
    if (order.status !== 'pending') return NextResponse.json({ error: 'ORDER_NOT_PENDING' }, { status: 409 });
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 });

    const expected = Number(order.amount_ves ?? order.amount);
    if (Math.abs(amountPaid - expected) > 0.02) return NextResponse.json({ error: 'AMOUNT_MISMATCH' }, { status: 409 });

    const { data: rawFinalized, error: finalizeError } = await supabase.rpc('confirm_pagoflash_payment', {
      p_order_id: order.id,
      p_provider_reference: typeof payload.reference === 'string' ? payload.reference.trim().slice(0, 180) : null,
      p_paid_at: paidAt ? paidAt.toISOString() : null,
    }).single();
    const finalized = rawFinalized as FinalizedPayment | null;
    if (finalizeError || !finalized) return NextResponse.json({ error: 'PAYMENT_FINALIZATION_FAILED' }, { status: 500 });

    return NextResponse.json({ ok: true, order_id: order.id, sale_id: finalized.sale_id, commission_id: finalized.commission_id ?? null });
  } catch (error) {
    console.error('pagoflash_webhook_unhandled', { code: error instanceof Error ? error.name : 'UNKNOWN' });
    return NextResponse.json({ error: 'WEBHOOK_FAILED' }, { status: 500 });
  }
}
