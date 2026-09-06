import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, PageHeader, EmptyState } from '@/components/platform-shell';
import { ArrowRight, BookOpen, CheckCircle2, MessageCircle, Package, PlayCircle, Sparkles, Target, Wand2 } from 'lucide-react';
import { AffiliateProductLink } from '@/components/affiliate-product-link';
import { AffiliateProductPerformance } from '@/components/affiliate-product-performance';

export const dynamic = 'force-dynamic';

export default async function AffiliateSalesCenterPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name,role,status')
    .eq('id', user.id)
    .single();
  if (!profile || profile.role !== 'affiliate' || profile.status !== 'active') redirect('/');

  const { data: affiliate } = await supabase.from('affiliates').select('id').eq('profile_id', user.id).eq('status','active').single();
  if (!affiliate) redirect('/');

  const { data: catalog, error } = await supabase
    .from('products')
    .select('id,name,slug,short_description,description,price,currency,default_commission,landing_url,cover_image,studio_data,status,created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  const { data: assignments } = await supabase
    .from('affiliate_products')
    .select('product_id,commission_percent,status')
    .eq('affiliate_id', affiliate.id)
    .eq('status', 'active');
  const commissionByProduct = new Map((assignments ?? []).map((x: any) => [x.product_id, x.commission_percent]));
  const products = (catalog ?? []).filter((p: any) => commissionByProduct.has(p.id)).map((p: any) => ({
    ...p,
    commission_percent: commissionByProduct.get(p.id) ?? p.default_commission,
  }));
  if (error) {
  return <PlatformShell role="affiliate" name={profile.full_name || 'Afiliado'}><PageHeader eyebrow="CENTRO DE VENTA" title="Centro de Venta" description="Tu sistema para aprender a vender cada producto."/><EmptyState icon={<Sparkles size={22}/>} title="No pudimos cargar tus productos" description={error.message}/></PlatformShell>;
  }

  if (!products?.length) {
  return <PlatformShell role="affiliate" name={profile.full_name || 'Afiliado'}><PageHeader eyebrow="CENTRO DE VENTA" title="Centro de Venta" description="Tu sistema para aprender a vender cada producto."/><EmptyState icon={<Sparkles size={22}/>} title="Todavía no hay productos activos" description="Cuando Rebuscándome active un producto, aquí tendrás su estrategia, argumentarios, contenido y cierre paso a paso."/></PlatformShell>;
  }

  const product = products.find(p => p.slug === params.product) ?? products[0];
  const { data: materials } = await supabase
    .from('materials')
    .select('id,title,type,content,description,file_url,status')
    .eq('product_id', product.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  const { data: productAssets } = await supabase
    .from('product_assets')
    .select('id,asset_type,storage_path,position,original_name,metadata')
    .eq('product_id', product.id)
    .eq('status','active')
    .order('position', { ascending: true });

  let productCover = product.cover_image;
  const coverAsset = (productAssets ?? []).find((a:any) => ['cover','thumbnail'].includes(a.asset_type));
  if (coverAsset) {
    const { data: coverSigned } = await supabase.storage.from('product-assets').createSignedUrl(coverAsset.storage_path, 3600);
    productCover = coverSigned?.signedUrl ?? productCover;
  }

  const resourceAssets = (productAssets ?? []).filter((a:any) => {
    if (['cover','gallery','thumbnail'].includes(a.asset_type)) return false;
    const meta = (a.metadata && typeof a.metadata === 'object') ? a.metadata : {};
    if (meta.source === 'admin_resources' && meta.visibility !== 'published') return false;
    return true;
  });
  const signedResourceAssets = await Promise.all(resourceAssets.map(async (asset:any) => {
    const { data } = await supabase.storage.from('product-assets').createSignedUrl(asset.storage_path, 3600);
    const meta = (asset.metadata && typeof asset.metadata === 'object') ? asset.metadata : {};
    return {
      id: `asset-${asset.id}`,
      title: meta.title || asset.original_name || 'Recurso',
      type: meta.display_type || asset.asset_type,
      description: meta.description || 'Recurso del producto',
      signed_url: data?.signedUrl || null
    };
  }));
  const resourceItems = [
    ...(materials ?? []).map((item:any) => ({ id: `material-${item.id}`, title: item.title, type: item.type, description: item.description || item.content || 'Recurso promocional.', signed_url: item.file_url || null })),
    ...signedResourceAssets,
  ];

  const studio = (product as any).studio_data || {};
  const avatar = studio.audience || 'Define aquí el perfil del cliente ideal.';
  const promise = studio.transformation || 'Define la transformación principal que promete la oferta.';
  const salesStrategy = studio.salesStrategy || '';
  const benefits = studio.benefits || '';
  const angles = studio.angles || studio.angle ? [{ id:'studio-angle', title:'Ángulo principal', content: studio.angles || studio.angle }] : [];
  const hooks = studio.hooks ? [{ id:'studio-hook', content: studio.hooks }] : [];
  const objections = studio.objections ? [{ id:'studio-objection', title:'Objeciones frecuentes', content: studio.objections }] : [];
  const strategy = studio.strategy ? [{ id:'studio-strategy', content: studio.strategy }] : [];
  const whatsapp = studio.whatsapp ? [{ id:'studio-whatsapp', title:'WhatsApp', content: studio.whatsapp }] : [];
  const instagram = studio.instagram ? [{ id:'studio-instagram', content: studio.instagram }] : [];
  const tiktok = studio.tiktok ? [{ id:'studio-tiktok', content: studio.tiktok }] : [];
  const ads = studio.ads ? [{ id:'studio-ads', content: studio.ads }] : [];

  const channels: Array<[string, any[]]> = [['Instagram', instagram as any[]],['TikTok', tiktok as any[]],['Publicidad', ads as any[]],['Estrategia', strategy as any[]]];

  const money = `${product.currency === 'USD' ? '$' : `${product.currency} `}${Number(product.price).toFixed(2)}`;
  const commissionRate = product.commission_percent == null ? Number(product.default_commission) : Number(product.commission_percent);
  const commission = (Number(product.price) * commissionRate / 100).toFixed(2);

  const [{ data: productClicks }, { data: productSales }, { data: productCommissions }] = await Promise.all([
    supabase.from('clicks').select('id').eq('affiliate_id', affiliate.id).eq('product_id', product.id),
    supabase.from('sales').select('id,gross_amount,status,commission_amount').eq('affiliate_id', affiliate.id).eq('product_id', product.id),
    supabase.from('commissions').select('id,amount,status').eq('affiliate_id', affiliate.id).eq('product_id', product.id)
  ]);
  const performanceClicks = (productClicks ?? []).length;
  const performanceSales = (productSales ?? []).filter((x:any) => x.status === 'confirmed');
  const performanceRevenue = performanceSales.reduce((n:number, x:any) => n + Number(x.gross_amount || 0), 0);
  const performanceCommission = performanceSales.reduce((n:number, x:any) => n + Number(x.commission_amount || 0), 0);
  const performanceConversion = performanceClicks ? (performanceSales.length / performanceClicks) * 100 : 0;

  let affiliateLink = null;
  if (affiliate) {
    const { data } = await supabase
      .from('tracking_links')
      .select('id,code,product_id,affiliate_id,status')
      .eq('affiliate_id', affiliate.id)
      .eq('product_id', product.id)
      .eq('status', 'active')
      .maybeSingle();
    affiliateLink = data;
  }

  return (
    <PlatformShell role="affiliate" name={profile.full_name || 'Afiliado'}>
      <PageHeader
        eyebrow="CENTRO DE VENTA"
        title={`Cómo vender · ${product.name}`}
        description="La información que el administrador configure en el producto se convierte aquí en tu guía comercial."
        action={<div className="native-actions"><Link className="ghost-link" href={`/afiliado/centro-venta?product=${product.slug}`}>Producto actual</Link>{product.landing_url && <a className="native-primary" href={product.landing_url} target="_blank" rel="noreferrer">Ver landing <ArrowRight size={15}/></a>}</div>}
      />

      <section className="sales-product-switcher panel-card">
        <div className="sales-product-switcher-head"><div><span className="section-kicker">PRODUCTOS PARA PROMOCIONAR</span><h2>Elige qué quieres vender</h2><p>Tienes acceso a todos los productos activos. Selecciona uno para abrir su estrategia, recursos y enlace de afiliado.</p></div><span className="sales-product-count">{products.length} activos</span></div>
        <div className="sales-product-switcher-grid">
          {products.map((item:any) => {
            const isActive = item.id === product.id;
            const itemRate = Number(item.commission_percent ?? item.default_commission ?? 0);
            return <Link key={item.id} href={`/afiliado/centro-venta?product=${encodeURIComponent(item.slug)}`} className={`sales-product-switcher-card ${isActive ? 'active' : ''}`}>
              <div className="sales-product-switcher-icon"><Package size={18}/></div>
              <div><strong>{item.name}</strong><span>{item.currency === 'USD' ? '$' : `${item.currency} `}{Number(item.price).toFixed(2)} · {itemRate.toFixed(0)}% comisión</span></div>
              <ArrowRight size={15}/>
            </Link>;
          })}
        </div>
      </section>

      <AffiliateProductLink existing={affiliateLink} productId={product.id} productSlug={product.slug} />

      <div className="sales-center-hero visual-sales-hero">
        <div className="sales-center-product">
          <div className="sales-center-visual">{productCover ? <img src={productCover} alt=""/> : <Sparkles size={34}/>}</div>
          <div>
            <span className="section-kicker">PRODUCTO ACTIVO</span>
            <h2>{product.name}</h2>
            <p>{product.short_description || product.description || 'Producto digital preparado para promocionar.'}</p>
            <div className="sales-center-meta"><strong>{money}</strong><span>{commissionRate.toFixed(0)}% comisión</span><b>Ganas ${commission}</b></div>
          </div>
        </div>
        <div className="sales-center-next">
          <span className="section-kicker">TU SIGUIENTE PASO</span>
          <h3>Aprende antes de publicar.</h3>
          <p>Revisa el cliente ideal, el ángulo y el contenido recomendado antes de compartir tu enlace.</p>{salesStrategy && <div className="sales-strategy-highlight"><span>RUTA DE VENTA</span><p>{salesStrategy}</p></div>}
          <div className="sales-center-actions"><Link className="native-primary" href={`/afiliado/academia?product=${product.slug}`}><BookOpen size={15}/> Ver formación</Link><AffiliateProductPerformance productId={product.id} productName={product.name} /><Link className="ghost-link" href={`/afiliado/materiales?product=${product.slug}`}>Ver materiales <ArrowRight size={15}/></Link></div>
        </div>
      </div>

      <div className="sales-center-grid">
        <section className="native-card sales-section"><div className="sales-section-head"><Target size={20}/><div><span className="section-kicker">01 · CLIENTE</span><h2>A quién le hablamos</h2></div></div><p>{avatar || 'El administrador definirá aquí el avatar, contexto y situación del comprador ideal.'}</p></section><section className="native-card sales-section"><div className="sales-section-head"><CheckCircle2 size={20}/><div><span className="section-kicker">02 · TRANSFORMACIÓN</span><h2>Qué valor comunicamos</h2></div></div><p>{promise}</p>{benefits&&<div className="sales-benefits-text"><strong>Beneficios clave</strong><p>{benefits}</p></div>}</section>
        <section className="native-card sales-section"><div className="sales-section-head"><Wand2 size={20}/><div><span className="section-kicker">02 · ÁNGULOS</span><h2>Motivos para comprar</h2></div></div>{angles.length ? <div className="sales-chip-list">{angles.map(item => <div key={item.id}><strong>{item.title}</strong><p>{item.content}</p></div>)}</div> : <p>Cuando existan ángulos publicados, aparecerán aquí.</p>}</section>
        <section className="native-card sales-section"><div className="sales-section-head"><PlayCircle size={20}/><div><span className="section-kicker">03 · HOOKS</span><h2>Cómo detener el scroll</h2></div></div>{hooks.length ? <div className="sales-quote-list">{hooks.slice(0,6).map(item => <blockquote key={item.id}>“{item.content}”</blockquote>)}</div> : <p>Publicaremos hooks listos para Reels, Stories y anuncios.</p>}</section>
        <section className="native-card sales-section"><div className="sales-section-head"><MessageCircle size={20}/><div><span className="section-kicker">04 · WHATSAPP</span><h2>Conversación</h2></div></div>{whatsapp.length ? whatsapp.map(item => <div className="sales-script" key={item.id}><strong>{item.title}</strong><p>{item.content}</p></div>) : <p>Los guiones de conversación aparecerán cuando estén publicados.</p>}</section>
      </div>

      <section className="native-card sales-big-section"><div className="sales-section-head"><CheckCircle2 size={20}/><div><span className="section-kicker">05 · OBJECIONES</span><h2>Responde sin improvisar</h2></div></div>{objections.length ? <div className="objection-grid">{objections.map(item => <article key={item.id}><strong>{item.title}</strong><p>{item.content}</p></article>)}</div> : <p>El administrador podrá cargar objeciones y respuestas específicas del producto.</p>}</section>

      <section className="native-card sales-big-section"><div className="sales-section-head"><Sparkles size={20}/><div><span className="section-kicker">06 · RUTA DE CONTENIDO</span><h2>Canales recomendados</h2></div></div><div className="channel-grid">{channels.map(([label, items]) => <article key={label}><strong>{label}</strong>{(items as any[])?.length ? (items as any[]).slice(0,2).map(item => <p key={item.id}>{item.content}</p>) : <p>Preparado para contenido específico.</p>}</article>)}</div></section>

      <section className="native-card sales-big-section"><div className="sales-section-head"><Package size={20}/><div><span className="section-kicker">07 · RECURSOS</span><h2>Materiales para publicar</h2></div></div><div className="sales-resource-strip">{resourceItems.slice(0,6).map((item:any)=><article key={item.id}><span>{item.type}</span><strong>{item.title}</strong><p>{item.description}</p></article>)}</div>{!resourceItems.length && <p>El administrador todavía no ha publicado recursos para este producto.</p>}<div style={{marginTop:14}}><Link className="native-secondary" href={`/afiliado/materiales?product=${product.slug}`}>Ver todos los recursos <ArrowRight size={15}/></Link></div></section>
    </PlatformShell>
  );
}
