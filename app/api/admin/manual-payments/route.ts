import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireSameOrigin } from '@/lib/security/request';
import { randomBytes, createHash } from 'node:crypto';
import { sendPurchaseConfirmation } from '@/lib/email/purchase';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, response: NextResponse.json({ ok: false, message: 'No autenticado.' }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('role,status').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin' || profile.status !== 'active') {
    return { ok: false as const, response: NextResponse.json({ ok: false, message: 'Acceso administrativo requerido.' }, { status: 403 }) };
  }
  return { ok: true as const, supabase };
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const service = createServiceClient();
  const { data, error } = await service
    .from('orders')
    .select('id,product_id,affiliate_id,amount_usd,amount_ves,exchange_rate,payment_method,payment_reference,status,created_at,customers(email,name),products(name),affiliates(affiliate_code,profiles(full_name)),order_payment_receipts(id,storage_path,original_name,mime_type,file_size,created_at)')
    .eq('payment_provider', 'manual')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ ok: false, message: 'MANUAL_PAYMENTS_LOAD_FAILED' }, { status: 500 });

  const orders = [];
  for (const order of data ?? []) {
    const receipts = Array.isArray((order as any).order_payment_receipts) ? (order as any).order_payment_receipts : [(order as any).order_payment_receipts].filter(Boolean);
    const receipt = receipts.sort((a: any, b: any) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ?? null;
    let receiptUrl = null;
    if (receipt?.storage_path) {
      const { data: signed } = await service.storage.from('payment-receipts').createSignedUrl(receipt.storage_path, 10 * 60);
      receiptUrl = signed?.signedUrl ?? null;
    }
    orders.push({
      ...order,
      receipt: receipt ? {
        id: receipt.id,
        original_name: receipt.original_name,
        mime_type: receipt.mime_type,
        file_size: receipt.file_size,
        created_at: receipt.created_at,
        receipt_url: receiptUrl,
      } : null,
    });
  }
  return NextResponse.json({ ok: true, orders });
}

export async function POST(request: Request) {
  const sameOrigin = requireSameOrigin(request);
  if (sameOrigin) return sameOrigin;
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json() as Record<string, unknown>;
    const orderId = typeof body.order_id === 'string' ? body.order_id : '';
    const action = typeof body.action === 'string' ? body.action : '';
    const reference = typeof body.reference === 'string' ? body.reference.slice(0, 180) : null;
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null;
    if (!orderId || !['confirm', 'reject'].includes(action)) {
      return NextResponse.json({ ok: false, message: 'Solicitud inválida.' }, { status: 400 });
    }

    const service = createServiceClient();

    if (action === 'confirm') {
      const { data: order, error: orderError } = await service
        .from('orders')
        .select('id,customer_id,product_id,status,payment_reference,customers(email,name),products(name)')
        .eq('id', orderId)
        .maybeSingle();
      if (orderError || !order) return NextResponse.json({ ok: false, message: 'Orden no encontrada.' }, { status: 404 });
      if (order.status !== 'pending') return NextResponse.json({ ok: false, message: 'La orden ya no está pendiente.' }, { status: 409 });

      const accessToken = randomBytes(48).toString('base64url');
      const accessHash = createHash('sha256').update(accessToken).digest('hex');
      const accessUrl = `${(process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://rebuscandome.vercel.app')}/entrega/${accessToken}`;
      const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
      const product = Array.isArray(order.products) ? order.products[0] : order.products;

      // Important: execute the RPC with the authenticated admin client so auth.uid()
      // remains available to is_admin() inside the database function.
      const { data, error } = await guard.supabase.rpc('confirm_manual_payment', {
        p_order_id: orderId,
        p_payment_reference: reference || order.payment_reference || null,
        p_access_token_hash: accessHash,
        p_access_token_last4: accessToken.slice(-4),
      }).single();

      if (error || !data) {
        console.error('manual_payment_confirm_failed', { code: error?.code ?? 'UNKNOWN', message: error?.message ?? 'NO_DATA' });
        return NextResponse.json({ ok: false, message: error?.message ?? 'No se pudo confirmar el pago.' }, { status: 409 });
      }

      const emailResult = customer?.email && product?.name
        ? await sendPurchaseConfirmation({
            to: String(customer.email),
            customerName: customer.name ? String(customer.name) : null,
            productName: String(product.name),
            accessUrl,
          })
        : { sent: false as const, reason: 'CUSTOMER_DATA_MISSING' };

      const { data: orderAffiliate } = await service.from('orders').select('affiliate_id').eq('id', orderId).maybeSingle();
      if (orderAffiliate?.affiliate_id) {
        const { data: aff } = await service.from('affiliates').select('profile_id').eq('id', orderAffiliate.affiliate_id).maybeSingle();
        if (aff?.profile_id) await service.from('notifications').insert({ user_id: aff.profile_id, type: 'sale_confirmed', title: 'Venta confirmada', message: `${String(product?.name || 'Producto')} generó una nueva comisión.`, });
      }
      const { data: adminUser } = await guard.supabase.auth.getUser();
      if (adminUser.user?.id) await service.from('notifications').insert({ user_id: adminUser.user.id, type: 'payment_confirmed', title: 'Pago confirmado', message: `La orden ${orderId.slice(0,8)} quedó confirmada y el acceso privado fue generado.`, });

      return NextResponse.json({ ok: true, result: data, access_url: accessUrl, email: emailResult });
    }

    const { data, error } = await guard.supabase.rpc('reject_manual_payment', {
      p_order_id: orderId,
      p_reason: reason,
    }).single();
    if (error || !data) {
      console.error('manual_payment_reject_failed', { code: error?.code ?? 'UNKNOWN', message: error?.message ?? 'NO_DATA' });
      return NextResponse.json({ ok: false, message: error?.message ?? 'No se pudo rechazar el pago.' }, { status: 409 });
    }
    return NextResponse.json({ ok: true, result: data });
  } catch (error) {
    console.error('manual_payment_action_unhandled', { code: error instanceof Error ? error.name : 'UNKNOWN' });
    return NextResponse.json({ ok: false, message: 'MANUAL_PAYMENT_ACTION_FAILED' }, { status: 500 });
  }
}
