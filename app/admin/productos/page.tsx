import { redirect } from 'next/navigation';
import ProductStatusActions from '@/components/product-status-actions';
import Link from 'next/link';
import { ExternalLink, Package, Plus, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, PageHeader, EmptyState } from '@/components/platform-shell';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage({ searchParams }: { searchParams?: Promise<{ created?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');
  const { data: me } = await supabase.from('profiles').select('full_name,role,status').eq('id', user.id).single();
  if (!me || me.role !== 'admin' || me.status !== 'active') redirect('/');

  const { data: products } = await supabase
    .from('products')
    .select('id,name,slug,short_description,price,currency,default_commission,landing_url,cover_image,status,created_at')
    .order('created_at', { ascending: false });

  const ids = (products ?? []).map(p => p.id);
  const { data: coverAssets } = ids.length ? await supabase
    .from('product_assets')
    .select('product_id,storage_path,asset_type,position')
    .in('product_id', ids)
    .in('asset_type', ['cover','thumbnail'])
    .eq('status','active')
    .order('position', { ascending: true }) : { data: [] as any[] };

  const signedCoverByProduct = new Map<string,string>();
  for (const product of products ?? []) {
    const asset = (coverAssets ?? []).find((row:any) => row.product_id === product.id);
    if (!asset?.storage_path) continue;
    const { data: signed } = await supabase.storage.from('product-assets').createSignedUrl(asset.storage_path, 60 * 60);
    if (signed?.signedUrl) signedCoverByProduct.set(product.id, signed.signedUrl);
  }

  const params = searchParams ? await searchParams : {};

  return (
    <PlatformShell role="admin" name={me.full_name || 'Administrador'}>
      <PageHeader
        eyebrow="CATÁLOGO DE PRODUCTOS"
        title="Productos"
        description="Administra el catálogo de infoproductos que estarán disponibles para nuestros afiliados."
        action={<Link className="native-primary" href="/admin/productos/nuevo"><Plus size={16}/> Crear producto</Link>}
      />

      {params.created === '1' && <div className="native-success" style={{marginBottom:16}}>Producto creado correctamente como borrador. Revísalo antes de activarlo.</div>}

      <section className="products-catalog-toolbar panel-card">
        <div>
          <span className="section-kicker">CATÁLOGO</span>
          <h2>{products?.length ?? 0} productos registrados</h2>
          <p>Desde aquí puedes revisar el estado, precio, comisión y miniatura real de cada producto.</p>
        </div>
        <div className="catalog-actions-inline">
          <Link className="native-secondary" href="/admin/formacion"><Sparkles size={15}/> Estrategias de venta</Link>
          <Link className="native-primary" href="/admin/productos/nuevo"><Plus size={15}/> Nuevo producto</Link>
        </div>
      </section>

      {(!products || products.length === 0) ? (
        <div style={{marginTop:16}}>
          <EmptyState
            icon={<Package size={24}/>} 
            title="Todavía no hay productos"
            description="Cuando estés listo, crea el primero desde el Product Studio. Allí cargarás la información, la landing y los recursos que utilizará el afiliado."
            action={<Link className="native-primary" href="/admin/productos/nuevo"><Plus size={15}/> Crear mi primer producto</Link>}
          />
        </div>
      ) : (
        <section className="product-catalog-grid">
          {products.map((product) => {
            const cover = signedCoverByProduct.get(product.id) || product.cover_image;
            return <article className="catalog-product-card" key={product.id}>
              <div className="catalog-product-cover">
                {cover ? <img src={cover} alt={`Miniatura de ${product.name}`}/> : <div className="catalog-product-cover-empty"><Package size={24}/><span>Sin miniatura</span></div>}
                <span className={`status-pill ${product.status}`}>{product.status === 'draft' ? 'Borrador' : product.status === 'active' ? 'Activo' : product.status === 'paused' ? 'Pausado' : 'Archivado'}</span>
              </div>
              <div className="catalog-product-body">
                <span className="catalog-product-category">{product.currency}</span>
                <h3>{product.name}</h3>
                <p>{product.short_description || 'Sin descripción corta todavía.'}</p>
                <div className="catalog-product-metrics">
                  <div><small>Precio</small><strong>{product.currency} {Number(product.price).toFixed(2)}</strong></div>
                  <div><small>Afiliado</small><strong>{Number(product.default_commission).toFixed(0)}%</strong></div>
                  <div><small>Gana</small><strong>{product.currency} {(Number(product.price) * Number(product.default_commission) / 100).toFixed(2)}</strong></div>
                </div>
                <div className="catalog-product-actions">
                  {product.landing_url ? <a className="native-secondary" href={product.landing_url} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Landing</a> : <span className="native-secondary disabled-link">Sin landing</span>}
                  <div className="catalog-product-actions-right"><Link className="native-secondary" href={`/admin/productos/${product.id}/editar`}>Editar</Link><Link className="native-primary" href={`/admin/productos/${product.id}`}>Gestionar</Link></div>
                </div>
                <ProductStatusActions productId={product.id} status={product.status} />
              </div>
            </article>;
          })}
        </section>
      )}
    </PlatformShell>
  );
}
