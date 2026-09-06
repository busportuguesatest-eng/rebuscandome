import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get('order')?.trim() ?? '';
  if (!UUID_RE.test(orderId)) {
    return NextResponse.json({ ok: false, message: 'Orden inválida.' }, { status: 400 });
  }

  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from('orders')
      .select('id,status,product_id,affiliate_id')
      .eq('id', orderId)
      .maybeSingle();

    if (error) {
      console.error('checkout_status_lookup_failed', { code: error.code });
      return NextResponse.json({ ok: false, message: 'No pudimos consultar el estado.' }, { status: 503 });
    }
    if (!data) return NextResponse.json({ ok: false, message: 'Orden no encontrada.' }, { status: 404 });

    const allowed = new Set(['paid', 'pending', 'cancelled', 'failed']);
    const status = allowed.has(String(data.status)) ? String(data.status) : 'pending';

    return NextResponse.json({
      ok: true,
      order: {
        id: data.id,
        status,
        product_id: data.product_id,
        affiliate_id: data.affiliate_id,
      },
    }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('checkout_status_unhandled', { code: error instanceof Error ? error.name : 'UNKNOWN' });
    return NextResponse.json({ ok: false, message: 'No pudimos consultar el estado.' }, { status: 503 });
  }
}
