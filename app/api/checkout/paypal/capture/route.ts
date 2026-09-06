import { randomBytes, createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { capturePayPalOrder } from '@/lib/payments/paypal';
import { sendPurchaseConfirmation } from '@/lib/email/purchase';
import { requireSameOrigin } from '@/lib/security/request';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const same = requireSameOrigin(request); if (same) return same;
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const orderId = typeof body?.order_id === 'string' ? body.order_id : '';
    const paypalOrderId = typeof body?.paypal_order_id === 'string' ? body.paypal_order_id : '';
    if (!orderId || !paypalOrderId) return NextResponse.json({ok:false,message:'Pago PayPal inválido.'},{status:400});
    const service = createServiceClient();
    const {data:order,error}=await service.from('orders').select('id,customer_id,product_id,affiliate_id,status,payment_method,payment_provider,provider_order_id,payment_reference,amount_usd,customers(email,name),products(name)').eq('id',orderId).maybeSingle();
    if(error||!order) return NextResponse.json({ok:false,message:'Orden no encontrada.'},{status:404});
    if(order.payment_method!=='paypal'||order.provider_order_id!==paypalOrderId) return NextResponse.json({ok:false,message:'La orden PayPal no coincide.'},{status:409});
    if(order.status==='paid') return NextResponse.json({ok:true,already_paid:true,order_id:order.id});
    if(order.status!=='pending') return NextResponse.json({ok:false,message:'La orden ya no está pendiente.'},{status:409});
    const capture=await capturePayPalOrder(paypalOrderId);
    if(capture.status!=='COMPLETED'||(capture.captureStatus&&capture.captureStatus!=='COMPLETED')) return NextResponse.json({ok:false,message:'PayPal no confirmó el pago.'},{status:409});
    if(capture.currency&&capture.currency!=='USD') return NextResponse.json({ok:false,message:'Moneda de PayPal no válida.'},{status:409});
    if(capture.amount&&Math.abs(Number(capture.amount)-Number(order.amount_usd))>0.01) return NextResponse.json({ok:false,message:'El monto de PayPal no coincide con la orden.'},{status:409});
    const accessToken=randomBytes(48).toString('base64url'); const accessHash=createHash('sha256').update(accessToken).digest('hex'); const accessLast4=accessToken.slice(-4);
    const {error:paidError}=await service.from('orders').update({status:'paid',payment_provider:'paypal',payment_reference:capture.captureId||paypalOrderId,access_token_last4:accessLast4,updated_at:new Date().toISOString()}).eq('id',orderId).eq('status','pending');
    if(paidError) return NextResponse.json({ok:false,message:'No pudimos cerrar la orden.'},{status:500});
    const {data:finalized,error:finalizeError}=await service.rpc('finalize_paid_order',{p_order_id:orderId,p_access_token_hash:accessHash,p_access_token_last4:accessLast4}).single();
    if(finalizeError||!finalized) return NextResponse.json({ok:false,message:'Pago confirmado, pero no pudimos preparar la entrega.'},{status:500});
    const customer=Array.isArray((order as any).customers)?(order as any).customers[0]:(order as any).customers; const product=Array.isArray((order as any).products)?(order as any).products[0]:(order as any).products;
    const site=process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/,'')||'https://rebuscandome.vercel.app'; const accessUrl=`${site}/entrega/${accessToken}`;
    const email=customer?.email&&product?.name?await sendPurchaseConfirmation({to:String(customer.email),customerName:customer.name?String(customer.name):null,productName:String(product.name),accessUrl}):{sent:false as const,reason:'CUSTOMER_DATA_MISSING'};
    if(order.affiliate_id){const {data:aff}=await service.from('affiliates').select('profile_id').eq('id',order.affiliate_id).maybeSingle(); if(aff?.profile_id) await service.from('notifications').insert({user_id:aff.profile_id,type:'sale_confirmed',title:'Venta confirmada',message:`${String(product?.name||'Producto')} generó una nueva comisión.`});}
    return NextResponse.json({ok:true,order_id:order.id,access_url:accessUrl,email,result:finalized});
  } catch(error){console.error('paypal_capture_unhandled',{code:error instanceof Error?error.name:'UNKNOWN'});return NextResponse.json({ok:false,message:error instanceof Error&&error.message==='PAYPAL_NOT_CONFIGURED'?'PayPal aún no está configurado.': 'No pudimos completar el pago PayPal.'},{status:500});}
}
