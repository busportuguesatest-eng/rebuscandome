import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSameOrigin } from '@/lib/security/request';

export async function PATCH(request: Request, { params }: { params: Promise<{ id:string }> }) {
  const same=requireSameOrigin(request); if(same) return same;
  const {id}=await params; const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) return NextResponse.json({ok:false,message:'No autenticado.'},{status:401});
  const {data:me}=await supabase.from('profiles').select('role,status').eq('id',user.id).single(); if(!me||me.role!=='admin'||me.status!=='active') return NextResponse.json({ok:false,message:'Acceso administrativo requerido.'},{status:403});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null; if(!body) return NextResponse.json({ok:false,message:'Solicitud inválida.'},{status:400});
  const patch={name:String(body.name||'').trim().slice(0,180),slug:String(body.slug||'').trim().slice(0,180),short_description:String(body.short_description||'').trim().slice(0,500),description:String(body.description||'').trim(),price:Number(body.price),currency:String(body.currency||'USD').trim(),default_commission:Number(body.default_commission),landing_url:body.landing_url?String(body.landing_url).trim().slice(0,500):null,status:String(body.status||'draft').trim()};
  if(!patch.name||!patch.slug||!Number.isFinite(patch.price)||patch.price<=0||!Number.isFinite(patch.default_commission)||patch.default_commission<0||patch.default_commission>100) return NextResponse.json({ok:false,message:'Revisa nombre, slug, precio y comisión.'},{status:400});
  if(!['USD','VES'].includes(patch.currency)||!['draft','active','paused','archived'].includes(patch.status)) return NextResponse.json({ok:false,message:'Valor de moneda o estado no válido.'},{status:400});
  const {data,error}=await supabase.from('products').update(patch).eq('id',id).select('id,name,slug').single(); if(error) return NextResponse.json({ok:false,message:error.code==='23505'?'Ese slug ya está en uso.':error.message},{status:400});
  return NextResponse.json({ok:true,product:data});
}
