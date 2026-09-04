import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireSameOrigin } from '@/lib/security/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX = 10 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

function safeName(name: string) {
  const ext = name.includes('.') ? `.${name.split('.').pop()}` : '';
  const base = name.replace(/\.[^/.]+$/, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'comprobante';
  return `${base}-${crypto.randomUUID().slice(0, 8)}${ext.toLowerCase()}`;
}

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  try {
    const form = await request.formData();
    const orderId = String(form.get('order_id') ?? '').trim();
    const reference = String(form.get('payment_reference') ?? '').trim().slice(0, 180);
    const file = form.get('receipt');
    if (!UUID_RE.test(orderId) || !(file instanceof File)) return NextResponse.json({ ok: false, message: 'Orden y comprobante son obligatorios.' }, { status: 400 });
    if (!file.size || file.size > MAX) return NextResponse.json({ ok: false, message: 'El comprobante debe pesar máximo 10 MB.' }, { status: 400 });
    if (!ALLOWED.has((file.type || '').toLowerCase())) return NextResponse.json({ ok: false, message: 'Solo aceptamos PDF, JPG, PNG o WEBP.' }, { status: 400 });

    const service = createServiceClient();
    const { data: order } = await service.from('orders').select('id,status,payment_method,customer_id,product_id').eq('id', orderId).maybeSingle();
    if (!order || !['pago_movil', 'transferencia'].includes(String(order.payment_method))) return NextResponse.json({ ok: false, message: 'Orden de pago manual no encontrada.' }, { status: 404 });
    if (order.status !== 'pending') return NextResponse.json({ ok: false, message: 'Esta orden ya no admite comprobantes.' }, { status: 409 });

    const path = `${order.product_id}/${order.id}/${safeName(file.name)}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await service.storage.from('payment-receipts').upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadError) return NextResponse.json({ ok: false, message: 'No pudimos guardar el comprobante.' }, { status: 503 });

    const { data: previous } = await service.from('order_payment_receipts').select('storage_path').eq('order_id', order.id).maybeSingle();
    if (previous?.storage_path) await service.storage.from('payment-receipts').remove([previous.storage_path]).catch(() => undefined);
    const { error: receiptError } = await service.from('order_payment_receipts').upsert({ order_id: order.id, storage_path: path, original_name: file.name, mime_type: file.type, file_size: file.size }, { onConflict: 'order_id' });
    if (receiptError) {
      await service.storage.from('payment-receipts').remove([path]).catch(() => undefined);
      return NextResponse.json({ ok: false, message: 'No pudimos registrar el comprobante.' }, { status: 503 });
    }
    const { error: orderUpdateError } = await service.from('orders').update({ payment_provider: 'manual', payment_reference: reference || null, updated_at: new Date().toISOString() }).eq('id', order.id).eq('status', 'pending');
    if (orderUpdateError) return NextResponse.json({ ok: false, message: 'Comprobante guardado, pero no pudimos actualizar la referencia.' }, { status: 503 });
    return NextResponse.json({ ok: true, receipt_id: order.id, message: 'Comprobante recibido. Tu pago quedará pendiente de verificación.' }, { status: 201 });
  } catch (error) {
    console.error('checkout_receipt_upload_failed', { code: error instanceof Error ? error.name : 'UNKNOWN' });
    return NextResponse.json({ ok: false, message: 'No fue posible recibir el comprobante.' }, { status: 503 });
  }
}
