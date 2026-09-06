import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Package, UploadCloud } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, PageHeader } from '@/components/platform-shell';
import AdminResourceManager from '@/components/admin-resource-manager';

export const dynamic = 'force-dynamic';

export default async function AdminResourcesPage() {
  const s = await createClient();
  const { data: { user } } = await s.auth.getUser(); if (!user) redirect('/');
  const { data: me } = await s.from('profiles').select('full_name,role,status').eq('id', user.id).single();
  if (!me || me.role !== 'admin' || me.status !== 'active') redirect('/');
  const { data: products } = await s.from('products').select('id,name').order('created_at', { ascending: false });
  return <PlatformShell role="admin" name={me.full_name || 'Administrador'}>
    <PageHeader eyebrow="FORMACIÓN & RECURSOS" title="Recursos promocionales" description="Carga y publica materiales que los afiliados utilizarán para promocionar cada producto." action={<Link className="native-secondary" href="/admin/formacion"><ArrowLeft size={15}/> Formación & Recursos</Link>}/>
    <div id="nuevo-recurso"><AdminResourceManager products={products || []}/></div>
    <section className="native-card" style={{marginTop:16}}><div className="panel-heading"><div><span className="section-kicker">ECOSISTEMA</span><h2>Cómo se entrega</h2></div><Package size={18}/></div><div className="admin-resource-flow"><span>Administrador</span><b>→</b><span>Supabase Storage</span><b>→</b><span>Producto</span><b>→</b><span>Centro de Venta</span><b>→</b><span>Afiliado</span></div><p style={{marginTop:12,color:'var(--muted)'}}>Los recursos publicados quedan vinculados al producto. Los afiliados activos pueden abrirlos desde su área; los borradores permanecen solo para administración.</p></section>
  </PlatformShell>;
}
