import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit3, ExternalLink, Package, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, PageHeader, EmptyState } from '@/components/platform-shell';
import { ProductDeliveryManager } from '@/components/product-delivery-manager';

export const dynamic='force-dynamic';

export default async function AdminProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');
  const { data: me } = await supabase.from('profiles').select('full_name,role,status').eq('id', user.id).single();
  if (!me || me.role !== 'admin' || me.status !== 'active') redirect('/');

  const { data: product } = await supabase.from('products')
    .select('id,name,slug,short_description,description,price,currency,default_commission,landing_url,cover_image,status,created_at,studio_data,checkout_code,delivery_enabled')
    .eq('id', id).single();
  if (!product) return <PlatformShell role="admin" name={me.full_name || 'Administrador'}><EmptyState icon={<Package size={22}/>} title="Producto no encontrado" description="El producto que intentas consultar ya no existe o no está disponible." action={<Link className="native-primary" href="/admin/productos"><ArrowLeft size={15}/> Volver a productos</Link>}/></PlatformShell>;

  const studio = (product.studio_data && typeof product.studio_data === 'object') ? product.studio_data as Record<string, any> : {};
  const { data: productAssets } = await supabase.from('product_assets').select('id,asset_type,storage_path,original_name,file_size').eq('product_id', product.id).eq('status','active');
  const resourceCount = (productAssets ?? []).filter((a:any) => !['cover','gallery','thumbnail'].includes(a.asset_type)).length;
  const deliveryAssets = (productAssets ?? []).filter((a:any) => ['delivery','ebook','bonus'].includes(a.asset_type)).map((a:any)=>({id:a.id,original_name:a.original_name,asset_type:a.asset_type,file_size:a.file_size ?? null}));
  let productCover = product.cover_image;
  const coverAsset = (productAssets ?? []).find((a:any) => ['cover','thumbnail'].includes(a.asset_type));
  if (coverAsset) { const { data: signed } = await supabase.storage.from('product-assets').createSignedUrl(coverAsset.storage_path, 3600); productCover = signed?.signedUrl ?? productCover; }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://rebuscandome.vercel.app';
  const checkoutCode = String((product as any).checkout_code || '');
  const checkoutUrl = checkoutCode ? `${siteUrl}/checkout?code=${encodeURIComponent(checkoutCode)}` : '';
  const embedSnippet = checkoutCode ? `<script src=\"${siteUrl}/checkout.js\" defer></script>\n<button type=\"button\" data-rebus-checkout=\"${checkoutCode}\">Comprar ahora</button>` : '';

  return <PlatformShell role="admin" name={me.full_name || 'Administrador'}>
    <PageHeader eyebrow="PRODUCTO" title={product.name} description="Resumen del producto y accesos a sus herramientas de administración." action={<div className="native-actions"><Link className="native-secondary" href="/admin/productos"><ArrowLeft size={15}/> Productos</Link><Link className="native-primary" href={`/admin/productos/${product.id}/editar`}><Edit3 size={15}/> Editar producto</Link></div>}/>
    <section className="product-detail-admin-grid">
      <div className="panel-card product-detail-admin-card">
        <div className="product-detail-admin-cover">{productCover ? <img src={productCover} alt=""/> : <Package size={34}/>}</div>
        <div className="product-detail-admin-copy"><span className={`status-pill ${product.status}`}>{product.status}</span><h2>{product.name}</h2><p>{product.description || product.short_description || 'Sin descripción.'}</p><div className="catalog-product-metrics"><div><small>Precio</small><strong>{product.currency} {Number(product.price).toFixed(2)}</strong></div><div><small>Comisión</small><strong>{Number(product.default_commission).toFixed(0)}%</strong></div><div><small>Afiliado gana</small><strong>{product.currency} {(Number(product.price)*Number(product.default_commission)/100).toFixed(2)}</strong></div></div></div>
      </div>
      <div className="panel-card"><span className="section-kicker">HERRAMIENTAS</span><h2>Gestionar ecosistema</h2><div className="product-admin-actions"><Link href={`/admin/estrategias/${product.id}`} className="quick-action-card"><Sparkles size={18}/><strong>Cómo vender</strong><span>Crear la metodología comercial del producto.</span></Link><Link href={product.landing_url||'#'} target={product.landing_url?'_blank':undefined} className={`quick-action-card ${!product.landing_url?'disabled-link':''}`}><ExternalLink size={18}/><strong>Landing Page</strong><span>{product.landing_url || 'Aún no configurada.'}</span></Link><Link href="/admin/materiales" className="quick-action-card"><Package size={18}/><strong>Materiales</strong><span>{resourceCount} recursos en la ficha inicial.</span></Link></div></div>
    </section>
    <section className="panel-card" style={{marginTop:16}}><span className="section-kicker">CHECKOUT DE VENTA</span><h2>Código conectado a esta venta</h2><p className="native-muted">Este código identifica el producto en el checkout central. Si un cliente llega desde un enlace de afiliado, la atribución viaja con el parámetro <code>ref</code> y queda asociada a la orden.</p><div style={{display:'grid',gap:10,marginTop:14}}><div className="tracking-url-box"><code>{checkoutCode || 'Generando…'}</code></div><div className="tracking-url-box"><code>{checkoutUrl || 'Checkout no disponible'}</code></div><textarea readOnly rows={4} value={embedSnippet} aria-label="Código para incrustar el checkout" style={{width:'100%',border:'1px solid #dce4ed',borderRadius:12,padding:12,fontFamily:'monospace',fontSize:12}} /></div></section>
    <section className="panel-card" style={{marginTop:16}}><ProductDeliveryManager productId={product.id} initialAssets={deliveryAssets}/></section>
    <section className="panel-card" style={{marginTop:16}}><span className="section-kicker">ENTREGA PRIVADA</span><h2>Página de entrega preparada</h2><p className="native-muted">No creamos una página pública por producto. Usamos una plantilla privada y segura; al confirmar manualmente una orden, el sistema genera un acceso único para ese comprador y muestra únicamente los recursos de entrega.</p><div className="product-detail-checklist"><span className={product.name?'ready':''}>Información</span><span className={product.landing_url?'ready':''}>Landing</span><span className={product.cover_image?'ready':''}>Portada</span><span className={resourceCount>0?'ready':''}>Recursos</span><span className={checkoutCode?'ready':''}>Código de Checkout</span><span className={product.delivery_enabled?'ready':''}>Entrega privada</span><span className="pending">Cómo vender · módulo separado</span><span className="pending">Academia · módulo de formación</span></div></section>
  </PlatformShell>;
}
