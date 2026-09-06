import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, PageHeader } from '@/components/platform-shell';
import { AdminProductStrategyEditor } from '@/components/admin-product-strategy-editor';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const dynamic='force-dynamic';

export default async function AdminStrategyPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params; const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/');
 const {data:me}=await supabase.from('profiles').select('full_name,role,status').eq('id',user.id).single();
 if(!me||me.role!=='admin'||me.status!=='active') redirect('/');
 const {data:product}=await supabase.from('products').select('id,name,studio_data').eq('id',id).single(); if(!product) redirect('/admin/productos');
 return <PlatformShell role="admin" name={me.full_name||'Administrador'}><PageHeader eyebrow="CÓMO VENDER" title={`Cómo vender · ${product.name}`} description="Esta estrategia es la fuente que alimenta el Centro de Venta del afiliado." action={<Link className="native-secondary" href={`/admin/productos/${product.id}`}><ArrowLeft size={15}/> Producto</Link>}/><section className="panel-card"><AdminProductStrategyEditor productId={product.id} productName={product.name} initialData={(product.studio_data||{}) as Record<string,unknown>} /></section></PlatformShell>;
}
