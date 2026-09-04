import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getCurrentUsdVesRate } from '@/lib/fx/rates';
import { requireSameOrigin } from '@/lib/security/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const QUOTE_MINUTES = Math.min(30, Math.max(5, Number(process.env.FX_QUOTE_TTL_MINUTES || 15)));

export async function POST(request: Request) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ ok:false, message:'Solicitud de cotización inválida.' },{status:400}); }
  try {
    const payload = body && typeof body === 'object' ? body as Record<string, unknown> : {};
    const productIdValue = typeof payload.product_id === 'string' ? payload.product_id.trim() : '';
    const checkoutCode = typeof payload.checkout_code === 'string' ? payload.checkout_code.trim().toUpperCase() : '';
    const refCode = typeof payload.ref === 'string' ? payload.ref.trim() : '';
    let productId = productIdValue; let affiliateId:string|null = null;
    if (checkoutCode && !/^RBCHK-[A-Z0-9]{12}$/.test(checkoutCode)) return NextResponse.json({ok:false,message:'Código de checkout inválido.'},{status:400});
    if (productId && !UUID_RE.test(productId)) return NextResponse.json({ok:false,message:'Producto inválido.'},{status:400});
    const service = createServiceClient();
    if (checkoutCode) {
      const {data:p,error} = await service.from('products').select('id').eq('checkout_code',checkoutCode).eq('status','active').maybeSingle();
      if(error) return NextResponse.json({ok:false,message:'No pudimos validar el código de checkout.'},{status:503});
      if(!p) return NextResponse.json({ok:false,message:'Código de checkout no encontrado o inactivo.'},{status:404});
      productId=p.id;
    }
    if(!UUID_RE.test(productId)) return NextResponse.json({ok:false,message:'Falta el producto del checkout.'},{status:400});
    if(refCode){ const {data:link}=await service.from('tracking_links').select('affiliate_id,product_id').eq('code',refCode).eq('status','active').maybeSingle(); if(!link||link.product_id!==productId) return NextResponse.json({ok:false,message:'La atribución de afiliado no corresponde a este producto.'},{status:409}); affiliateId=link.affiliate_id; }
    else { const v=payload.affiliate_id; affiliateId=v==null||v===''?null:String(v).trim(); if(affiliateId!==null&&!UUID_RE.test(affiliateId)) return NextResponse.json({ok:false,message:'Afiliado inválido.'},{status:400}); }

    const {data:product,error:productError}=await service.from('products').select('id,name,short_description,price,currency,status,cover_image').eq('id',productId).eq('status','active').maybeSingle();
    if(productError||!product) return NextResponse.json({ok:false,message:'Producto no disponible.'},{status:404});
    if(String(product.currency).toUpperCase()!=='USD') return NextResponse.json({ok:false,message:'El producto no está configurado en USD.'},{status:409});
    const priceUsd=Number(product.price); if(!Number.isFinite(priceUsd)||priceUsd<=0) return NextResponse.json({ok:false,message:'El producto no tiene un precio válido.'},{status:409});
    if(affiliateId){ const {data:assignment}=await service.from('affiliate_products').select('affiliate_id').eq('affiliate_id',affiliateId).eq('product_id',productId).eq('status','active').maybeSingle(); if(!assignment) return NextResponse.json({ok:false,message:'La atribución de afiliado no es válida.'},{status:409}); }

    let coverUrl=product.cover_image || null;
    const {data:asset}=await service.from('product_assets').select('storage_path').eq('product_id',productId).in('asset_type',['cover','thumbnail']).eq('status','active').order('position',{ascending:true}).limit(1).maybeSingle();
    if(asset?.storage_path){ const {data:signed}=await service.storage.from('product-assets').createSignedUrl(asset.storage_path,3600); coverUrl=signed?.signedUrl||coverUrl; }

    const fx=await getCurrentUsdVesRate(); const amountVes=Math.round(priceUsd*fx.rate*100)/100; const expiresAt=new Date(Date.now()+QUOTE_MINUTES*60000).toISOString();
    const {data:quote,error:quoteError}=await service.from('payment_quotes').insert({product_id:productId,affiliate_id:affiliateId,price_usd:priceUsd.toFixed(2),exchange_rate:fx.rate,amount_ves:amountVes.toFixed(2),rate_source:fx.source,rate_fetched_at:fx.fetchedAt,expires_at:expiresAt,status:'active'}).select('id,product_id,affiliate_id,price_usd,exchange_rate,amount_ves,rate_source,rate_fetched_at,expires_at').single();
    if(quoteError||!quote) return NextResponse.json({ok:false,message:'No se pudo crear la cotización.'},{status:503});

    const { data: paymentRows } = await service.from('payment_method_settings').select('method,enabled,bank_name,account,account_type,holder,identifier,phone').in('method',['pago_movil','transferencia']);
    const fallbackRows = [
      { method:'pago_movil', enabled:true, bank_name:process.env.MANUAL_PAYMENT_BANK_NAME?.trim()||'', account:'', account_type:'', holder:process.env.MANUAL_PAYMENT_HOLDER?.trim()||'', identifier:process.env.MANUAL_PAYMENT_IDENTIFIER?.trim()||'', phone:process.env.MANUAL_PAYMENT_PHONE?.trim()||'' },
      { method:'transferencia', enabled:true, bank_name:process.env.MANUAL_PAYMENT_BANK_NAME?.trim()||'', account:process.env.MANUAL_PAYMENT_ACCOUNT?.trim()||'', account_type:process.env.MANUAL_PAYMENT_ACCOUNT_TYPE?.trim()||'Cuenta bancaria', holder:process.env.MANUAL_PAYMENT_HOLDER?.trim()||'', identifier:process.env.MANUAL_PAYMENT_IDENTIFIER?.trim()||'', phone:'' },
    ];
    const configured = (paymentRows && paymentRows.length ? paymentRows : fallbackRows).filter((x:any)=>x.enabled);
    const selected = configured.find((x:any)=>x.method==='pago_movil') || fallbackRows[0];
    const payment={ pago_movil: configured.find((x:any)=>x.method==='pago_movil') || fallbackRows[0], transferencia: configured.find((x:any)=>x.method==='transferencia') || fallbackRows[1], selected };
    return NextResponse.json({ok:true,quote:{id:quote.id,product_id:quote.product_id,affiliate_id:quote.affiliate_id,price_usd:Number(quote.price_usd),exchange_rate:Number(quote.exchange_rate),amount_ves:Number(quote.amount_ves),rate_source:quote.rate_source,rate_fetched_at:quote.rate_fetched_at,expires_at:quote.expires_at,product:{name:product.name,short_description:product.short_description,cover_url:coverUrl},payment}}, {status:201});
  } catch(error){ console.error('checkout_quote_unhandled',{code:error instanceof Error?error.name:'UNKNOWN'}); return NextResponse.json({ok:false,message:'No fue posible obtener una cotización actualizada.'},{status:503}); }
}
