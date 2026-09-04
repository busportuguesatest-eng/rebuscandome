import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, PageHeader, EmptyState } from '@/components/platform-shell';
import { ArrowRight, ExternalLink, Package } from 'lucide-react';
import Link from 'next/link';
export const dynamic = 'force-dynamic';

type Asset = { id:string; asset_type:string; storage_path:string; position:number };

async function signedCover(supabase:any, productId:string, fallback:string|null){
  const { data: assets } = await supabase.from('product_assets')
    .select('id,asset_type,storage_path,position')
    .eq('product_id', productId).eq('status','active')
    .in('asset_type',['cover','thumbnail']).order('position',{ascending:true}).limit(1);
  const asset = (assets as Asset[]|null)?.[0];
  if(asset){ const { data } = await supabase.storage.from('product-assets').createSignedUrl(asset.storage_path, 3600); if(data?.signedUrl) return data.signedUrl; }
  return fallback;
}

export default async function AffiliateProductsPage(){
 const s=await createClient(); const {data:{user}}=await s.auth.getUser(); if(!user)redirect('/');
 const {data:p}=await s.from('profiles').select('full_name,role,status').eq('id',user.id).single(); if(!p||p.role!=='affiliate'||p.status!=='active')redirect('/');
 const {data:affiliate}=await s.from('affiliates').select('id').eq('profile_id',user.id).eq('status','active').single();
 if(!affiliate)return redirect('/');
 const {data:catalog,error}=await s.from('products').select('id,name,slug,short_description,price,currency,default_commission,landing_url,cover_image,status,created_at').eq('status','active').order('created_at',{ascending:false});
 const {data:assignments}=await s.from('affiliate_products').select('product_id,commission_percent,status').eq('affiliate_id',affiliate.id).eq('status','active');
 const commissionByProduct=new Map((assignments??[]).map((x:any)=>[x.product_id,x.commission_percent]));
 const products=(catalog||[]).map((x:any)=>({ ...x, commission_percent:commissionByProduct.get(x.id) ?? x.default_commission }));
 if(error)return <PlatformShell role="affiliate" name={p.full_name||'Afiliado'}><PageHeader eyebrow="PRODUCTOS" title="Productos para vender" description="Los productos activos están disponibles para todos los afiliados."/><EmptyState icon={<Package size={22}/>} title="No pudimos cargar los productos" description={error.message}/></PlatformShell>;
 if(!products?.length)return <PlatformShell role="affiliate" name={p.full_name||'Afiliado'}><PageHeader eyebrow="PRODUCTOS" title="Productos para vender" description="Los productos publicados por el administrador aparecerán aquí."/><EmptyState icon={<Package size={22}/>} title="Aún no hay productos disponibles" description="Cuando el administrador publique un producto aparecerá aquí."/></PlatformShell>;
 const cards=await Promise.all(products.map(async x=>({...x,cover_image:await signedCover(s,x.id,x.cover_image)})));
 return <PlatformShell role="affiliate" name={p.full_name||'Afiliado'}><PageHeader eyebrow="PRODUCTOS" title="Productos para vender" description="Elige un producto, conoce su oferta y llévalo a tu Centro de Venta."/>
 <section className="visual-section-banner products-banner"><div className="visual-section-copy"><span>CATÁLOGO DIGITAL</span><h2>Encuentra tu próxima oportunidad.</h2><p>Productos listos para promocionar, con recursos y una ruta comercial clara.</p></div></section>
 <section className="native-product-grid">{cards.map(x=>{const commissionRate=x.commission_percent==null?Number(x.default_commission):Number(x.commission_percent); const gain=Number(x.price)*commissionRate/100;return <article className="catalog-card" key={x.id}>{x.cover_image?<img src={x.cover_image} alt=""/>:<div className="catalog-placeholder"><Package size={26}/></div>}<div className="catalog-body"><span className="catalog-price">{x.currency==='USD'?'$':x.currency+' '}{Number(x.price).toFixed(2)}</span><h3>{x.name}</h3><p>{x.short_description||'Producto digital listo para promocionar.'}</p><div className="catalog-meta"><span>{commissionRate.toFixed(0)}% comisión</span><strong>{x.currency==='USD'?'$':x.currency+' '}{gain.toFixed(2)} por venta</strong></div><div className="catalog-actions"><Link className="native-primary" href={`/afiliado/centro-venta?product=${x.slug}`}>Vender este producto <ArrowRight size={15}/></Link>{x.landing_url&&<a className="ghost-link" href={x.landing_url} target="_blank" rel="noreferrer">Ver landing <ExternalLink size={14}/></a>}</div></div></article>})}</section></PlatformShell>
}
