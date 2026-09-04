import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createPagoFlashOrder } from '@/lib/payments/pagoflash';
import { requireSameOrigin } from '@/lib/security/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PendingOrder = {
  id: string;
  amount_usd: number | string;
  amount_ves: number | string;
  exchange_rate: number | string;
  rate_expires_at: string;
};

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function safeText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v && v.length <= max ? v : null;
}

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  try {
    const body = await request.json();
    const quoteId = body?.quote_id;
    const method = safeText(body?.payment_method, 30);
    const email = safeText(body?.customer_email, 320)?.toLowerCase() ?? null;
    const name = safeText(body?.customer_name, 160);
    const phone = safeText(body?.customer_phone, 40);
    const paymentReference = safeText(body?.payment_reference, 180);

    const allowedManual = method === 'pago_movil' || method === 'transferencia';
    if (!validUuid(quoteId) || !email || (!allowedManual && method !== 'pagoflash')) {
      return NextResponse.json({ ok: false, message: 'Datos de pago inválidos.' }, { status: 400 });
    }

    const service = createServiceClient();
    const { data: rawOrder, error: orderError } = await service.rpc('create_pending_order_from_quote', {
      p_quote_id: quoteId,
      p_payment_method: method,
      p_customer_email: email,
      p_customer_name: name,
      p_customer_phone: phone,
      p_customer_country: 'VE',
    }).single();
    const order = rawOrder as PendingOrder | null;

    if (orderError || !order) {
      console.error('checkout_pending_order_failed', { code: orderError?.code ?? 'UNKNOWN' });
      return NextResponse.json({ ok: false, message: 'La cotización ya no está disponible. Genera una nueva.' }, { status: 409 });
    }

    if (allowedManual) {
      await service.from('orders').update({
        payment_provider: 'manual',
        payment_reference: paymentReference,
      }).eq('id', order.id).eq('status', 'pending');

      const { data: settingsRow } = await service.from('payment_method_settings').select('method,enabled,bank_name,account,account_type,holder,identifier,phone').eq('method', method).eq('enabled', true).maybeSingle();
      const settings = settingsRow ?? {
        method, enabled:true,
        bank_name: method === 'pago_movil' ? process.env.MANUAL_PAYMENT_BANK_NAME?.trim() || '' : process.env.MANUAL_PAYMENT_BANK_NAME?.trim() || '',
        account: method === 'transferencia' ? process.env.MANUAL_PAYMENT_ACCOUNT?.trim() || '' : '',
        account_type: process.env.MANUAL_PAYMENT_ACCOUNT_TYPE?.trim() || 'Cuenta bancaria',
        holder: process.env.MANUAL_PAYMENT_HOLDER?.trim() || '', identifier: process.env.MANUAL_PAYMENT_IDENTIFIER?.trim() || '',
        phone: method === 'pago_movil' ? process.env.MANUAL_PAYMENT_PHONE?.trim() || '' : ''
      };
      const commonReady = method === 'pago_movil' ? Boolean(settings.bank_name && settings.identifier) : Boolean(settings.bank_name && settings.holder && settings.account);
      const methodReady = method === 'pago_movil' ? Boolean(settings.phone) : Boolean(settings.account);
      if (!commonReady || !methodReady || !settings.enabled) {
        await service.rpc('cancel_pending_checkout_order', { p_order_id: order.id });
        return NextResponse.json({ ok: false, message: 'Este método de pago no está configurado todavía.' }, { status: 503 });
      }

      return NextResponse.json({
        ok: true,
        order_id: order.id,
        provider: 'manual',
        method,
        amount_usd: Number(order.amount_usd),
        amount_ves: Number(order.amount_ves),
        exchange_rate: Number(order.exchange_rate),
        expires_at: order.rate_expires_at,
        instructions: settings,
      }, { status: 201 });
    }


    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
    const webhookToken = process.env.PAGOFLASH_WEBHOOK_TOKEN?.trim();
    if (!baseUrl) throw new Error('NEXT_PUBLIC_SITE_URL_NOT_CONFIGURED');
    if (!webhookToken || webhookToken.length < 32) throw new Error('PAGOFLASH_WEBHOOK_TOKEN_NOT_CONFIGURED');

    let provider;
    try {
      provider = await createPagoFlashOrder({
        orderId: order.id,
        amountVes: Number(order.amount_ves),
        description: `Rebuscándome - ${order.id}`,
        customerEmail: email,
        customerName: name,
        customerPhone: phone,
        expiresAt: order.rate_expires_at,
        successRedirectUrl: `${baseUrl}/pago/exito?order=${encodeURIComponent(order.id)}`,
        successCallbackUrl: `${baseUrl}/api/webhooks/payment/pagoflash/${encodeURIComponent(webhookToken)}`,
      });
    } catch (providerError) {
      await service.rpc('cancel_pending_checkout_order', { p_order_id: order.id });
      throw providerError;
    }

    const { error: attachError } = await service.rpc('attach_payment_provider_order', {
      p_order_id: order.id,
      p_payment_provider: 'pagoflash',
      p_provider_order_id: provider.providerOrderId,
      p_payment_url: provider.paymentUrl,
      p_payment_reference: provider.referenceCode,
    });

    if (attachError) {
      console.error('checkout_provider_attach_failed', { code: attachError.code });
      await service.rpc('cancel_pending_checkout_order', { p_order_id: order.id });
      return NextResponse.json({ ok: false, message: 'No pudimos preparar el pago. Intenta nuevamente.' }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      order_id: order.id,
      provider: 'pagoflash',
      payment_url: provider.paymentUrl,
      reference_code: provider.referenceCode ?? null,
      amount_usd: Number(order.amount_usd),
      amount_ves: Number(order.amount_ves),
      exchange_rate: Number(order.exchange_rate),
      expires_at: order.rate_expires_at,
    });
  } catch (error) {
    console.error('checkout_start_unhandled', { code: error instanceof Error ? error.name : 'UNKNOWN' });
    return NextResponse.json({ ok: false, message: 'No fue posible iniciar el pago en este momento.' }, { status: 503 });
  }
}
