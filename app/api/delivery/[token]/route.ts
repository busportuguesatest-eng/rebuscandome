import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = String(token || '').trim();
  if (!/^[A-Za-z0-9_-]{32,160}$/.test(clean)) return NextResponse.json({ ok: false, message: 'Acceso inválido.' }, { status: 400 });
  const hash = createHash('sha256').update(clean).digest('hex');
  try {
    const service = createServiceClient();
    const { data: accessRow, error: accessError } = await service
      .from('product_access')
      .select('id,order_id,customer_id,product_id,status')
      .eq('token_hash', hash)
      .eq('status', 'active')
      .maybeSingle();
    if (accessError || !accessRow) return NextResponse.json({ ok: false, message: 'Este acceso no es válido o ya fue revocado.' }, { status: 404 });
    const access = { access_id: accessRow.id, order_id: accessRow.order_id, customer_id: accessRow.customer_id, product_id: accessRow.product_id };
    await service.from('product_access').update({ last_used_at: new Date().toISOString() }).eq('id', accessRow.id);
    const { data: product } = await service.from('products').select('id,name,short_description,description').eq('id', access.product_id).single();
    if (!product) return NextResponse.json({ ok: false, message: 'Producto no encontrado.' }, { status: 404 });
    const { data: assets } = await service.from('product_assets').select('id,file_name,original_name,storage_path,mime_type,file_size,asset_type,position,metadata').eq('product_id', access.product_id).eq('status','active').in('asset_type',['ebook','delivery','bonus']).order('position', { ascending: true });
    const items = [];
    for (const asset of assets ?? []) {
      const { data: signed } = await service.storage.from('product-assets').createSignedUrl(asset.storage_path, 60 * 60);
      if (signed?.signedUrl) items.push({ ...asset, signed_url: signed.signedUrl });
    }
    return NextResponse.json({ ok: true, order_id: access.order_id, customer_id: access.customer_id, product, assets: items }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('delivery_access_failed', { code: error instanceof Error ? error.name : 'UNKNOWN' });
    return NextResponse.json({ ok: false, message: 'No pudimos preparar tu entrega.' }, { status: 503 });
  }
}
