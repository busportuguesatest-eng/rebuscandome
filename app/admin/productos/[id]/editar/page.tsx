import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell } from '@/components/platform-shell';
import ProductEditForm from '@/components/product-edit-form';
export const dynamic='force-dynamic';
export default async function EditProductPage({params}:{params:Promise<{id:string}>}){const {id}=await params;const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/');const {data:me}=await s.from('profiles').select('full_name,role,status').eq('id',user.id).single();if(!me||me.role!=='admin'||me.status!=='active')redirect('/');const {data:product}=await s.from('products').select('id,name,slug,short_description,description,price,currency,default_commission,landing_url,status').eq('id',id).single();if(!product)notFound();return <PlatformShell role="admin" name={me.full_name||'Administrador'}><ProductEditForm product={product as any}/></PlatformShell>}
