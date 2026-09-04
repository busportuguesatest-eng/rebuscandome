import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, PageHeader, EmptyState } from '@/components/platform-shell';
import { ArrowRight, Download, FileImage, FileText, Film, Package, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Asset = { id:string; asset_type:string; file_name:string; original_name:string|null; storage_path:string; mime_type:string|null; file_size:number|null; position:number; metadata:any }; 
type Material = { id:string; title:string; type:string; file_url:string|null; content:string|null; description:string; status:string };

function iconFor(type:string){
  const t = type.toLowerCase();
  if(t.includes('video') || t.includes('reel') || t.includes('story')) return <Film size={17}/>;
  if(t.includes('image') || t.includes('post') || t.includes('gallery') || t.includes('cover')) return <FileImage size={17}/>;
  return <FileText size={17}/>;
}

export default async function AffiliateMaterialsPage({ searchParams }:{searchParams:Promise<{product?:string}>}){
  const params = await searchParams;
  const supabase = await createClient();
  const { data:{user} } = await supabase.auth.getUser();
  if(!user) redirect('/');
  const { data: profile } = await supabase.from('profiles').select('full_name,role,status').eq('id',user.id).single();
  if(!profile || profile.role!=='affiliate' || profile.status!=='active') redirect('/');

  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('id')
    .eq('profile_id',user.id)
    .eq('status','active')
    .single();
  if (!affiliate) redirect('/');

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id,name,slug,short_description,cover_image,status,created_at')
    .eq('status','active')
    .order('created_at', { ascending:false });

  if(productsError) return <PlatformShell role="affiliate" name={profile.full_name||'Afiliado'}><PageHeader eyebrow="CENTRO DE VENTA" title="Recursos para promocionar" description="Creatividades, guiones y materiales que el administrador ha preparado para tus productos."/><EmptyState icon={<Package size={22}/>} title="No pudimos cargar los productos" description={productsError.message}/></PlatformShell>;
  if(!products?.length) return <PlatformShell role="affiliate" name={profile.full_name||'Afiliado'}><PageHeader eyebrow="CENTRO DE VENTA" title="Recursos para promocionar" description="Los recursos aparecerán cuando exista un producto activo."/><EmptyState icon={<Sparkles size={22}/>} title="Todavía no hay productos activos" description="Cuando Rebuscándome publique un producto, aquí aparecerán sus recursos promocionales."/></PlatformShell>;

  const product = products.find(p=>p.slug===params.product) ?? products[0];
  const [{ data:materials }, { data:assets }] = await Promise.all([
    supabase.from('materials').select('id,title,type,file_url,content,description,status').eq('product_id',product.id).eq('status','published').order('created_at',{ascending:false}),
    supabase.from('product_assets').select('id,asset_type,file_name,original_name,storage_path,mime_type,file_size,position,metadata').eq('product_id',product.id).eq('status','active').order('position',{ascending:true})
  ]);

  let productCover = product.cover_image;
  const coverAsset = (assets??[]).find((a:Asset) => ['cover','thumbnail'].includes(a.asset_type));
  if (coverAsset) { const { data: coverSigned } = await supabase.storage.from('product-assets').createSignedUrl(coverAsset.storage_path, 3600); productCover = coverSigned?.signedUrl ?? productCover; }

  const visibleAssets = (assets??[]).filter((asset:Asset) => {
    if(['cover','gallery','thumbnail'].includes(asset.asset_type)) return false;
    const meta = (asset.metadata && typeof asset.metadata === 'object') ? asset.metadata : {};
    if(meta.source === 'admin_resources' && meta.visibility !== 'published') return false;
    return true;
  });
  const signedAssets = await Promise.all(visibleAssets.map(async (asset:Asset)=>{
    const { data } = await supabase.storage.from('product-assets').createSignedUrl(asset.storage_path, 3600);
    const meta = (asset.metadata && typeof asset.metadata === 'object') ? asset.metadata : {};
    return { ...asset, signed_url:data?.signedUrl||null, display_title: meta.title || asset.original_name || asset.file_name, display_type: meta.display_type || asset.asset_type, display_description: meta.description || asset.mime_type || 'Recurso del producto' };
  }));

  return <PlatformShell role="affiliate" name={profile.full_name||'Afiliado'}>
    <PageHeader
      eyebrow="CENTRO DE VENTA · RECURSOS"
      title="Materiales promocionales"
      description={`Recursos disponibles para promocionar ${product.name}.`}
      action={<div className="native-actions"><Link className="ghost-link" href={`/afiliado/centro-venta?product=${product.slug}`}>Volver a Centro de Venta</Link></div>}
    />

    <section className="native-card materials-product-banner">
      <div className="materials-product-thumb">{productCover?<img src={productCover} alt=""/>:<Package size={28}/>}</div>
      <div><span className="section-kicker">PRODUCTO ACTIVO</span><h2>{product.name}</h2><p>{product.short_description||'Recursos listos para promocionar.'}</p></div>
      <Link className="native-primary" href={`/afiliado/centro-venta?product=${product.slug}`}>Ver estrategia <ArrowRight size={15}/></Link>
    </section>

    <div className="materials-grid">
      {(signedAssets??[]).map((asset:any)=><article key={asset.id} className="native-card material-resource-card">
        <div className="material-resource-icon">{iconFor(asset.asset_type)}</div>
        <div className="material-resource-main"><span className="material-resource-type">{asset.display_type}</span><h3>{asset.display_title}</h3><p>{asset.display_description}</p></div>
        {asset.signed_url?<a className="native-secondary" href={asset.signed_url} target="_blank" rel="noreferrer"><Download size={15}/> Abrir</a>:<span className="status">Disponible</span>}
      </article>)}
      {(materials??[]).map((item:Material)=><article key={item.id} className="native-card material-resource-card">
        <div className="material-resource-icon">{iconFor(item.type)}</div>
        <div className="material-resource-main"><span className="material-resource-type">{item.type}</span><h3>{item.title}</h3><p>{item.description||item.content||'Recurso promocional.'}</p></div>
        {item.file_url?<a className="native-secondary" href={item.file_url} target="_blank" rel="noreferrer"><Download size={15}/> Abrir</a>:<span className="status active">Texto</span>}
      </article>)}
    </div>

    {!signedAssets.length && !(materials??[]).length && <div className="native-card"><EmptyState icon={<Package size={20}/>} title="Todavía no hay recursos publicados" description="El administrador puede añadir creatividades, guiones, copies y archivos para este producto."/></div>}
  </PlatformShell>;
}
