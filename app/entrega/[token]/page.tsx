import Link from 'next/link';
import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export default async function DeliveryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = String(token || '').trim();
  let product: { name: string; short_description?: string | null; description?: string | null } | null = null;
  let assets: Array<{ id: string; file_name: string; original_name?: string | null; storage_path: string; mime_type?: string | null; asset_type: string; position: number; signed_url?: string }> = [];
  let valid = false;
  if (/^[A-Za-z0-9_-]{32,160}$/.test(clean)) {
    const hash = createHash('sha256').update(clean).digest('hex');
    const service = createServiceClient();
    const { data: accessRow } = await service
      .from('product_access')
      .select('id,order_id,customer_id,product_id,status')
      .eq('token_hash', hash)
      .eq('status', 'active')
      .maybeSingle();
    const access = accessRow ? { access_id: accessRow.id, order_id: accessRow.order_id, customer_id: accessRow.customer_id, product_id: accessRow.product_id } : null;
    if (access) {
      await service.from('product_access').update({ last_used_at: new Date().toISOString() }).eq('id', access.access_id);
      const { data: p } = await service.from('products').select('name,short_description,description').eq('id', access.product_id).single();
      const { data: rows } = await service.from('product_assets').select('id,file_name,original_name,storage_path,mime_type,asset_type,position').eq('product_id', access.product_id).eq('status','active').in('asset_type',['ebook','delivery','bonus']).order('position', { ascending: true });
      product = p;
      for (const row of rows ?? []) {
        const { data: signed } = await service.storage.from('product-assets').createSignedUrl(row.storage_path, 60 * 60);
        if (signed?.signedUrl) assets.push({ ...row, signed_url: signed.signedUrl });
      }
      valid = Boolean(product);
    }
  }
  return <main className="payment-result-page delivery-page">
    <div className="payment-result-card is-paid">
      <div className="payment-result-badge">Rebuscándome · Entrega</div>
      {valid && product ? <>
        <div className="payment-result-icon" aria-hidden="true">✓</div>
        <p className="payment-result-kicker">Tu compra está lista</p>
        <h1>¡Gracias por tu compra!</h1>
        <p className="payment-result-product">{product.name}</p>
        <p className="payment-result-copy">Aquí tienes los recursos incluidos en tu compra. Los enlaces son privados y temporales.</p>
        <div className="delivery-assets">{assets.length ? assets.map(asset => <a key={asset.id} href={asset.signed_url} target="_blank" rel="noreferrer" className="payment-primary-link"><span>{asset.asset_type === 'ebook' ? '📘' : '📦'}</span> Descargar {asset.original_name || asset.file_name}</a>) : <p>No hay recursos de entrega publicados todavía. Contacta al equipo de Rebuscándome.</p>}</div>
      </> : <>
        <div className="payment-result-icon" aria-hidden="true">!</div>
        <p className="payment-result-kicker">Acceso privado</p>
        <h1>Este enlace no es válido</h1>
        <p className="payment-result-copy">El acceso puede haber vencido, haber sido revocado o no existir.</p>
      </>}
      <div className="payment-result-actions"><Link href="/" className="payment-secondary-link">Volver a Rebuscándome</Link></div>
    </div>
  </main>;
}
