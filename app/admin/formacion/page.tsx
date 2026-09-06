import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, BookOpen, FileImage, Plus, Settings2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, EmptyState, PageHeader, KpiCard } from '@/components/platform-shell';

export const dynamic='force-dynamic';
export default async function AdminTrainingPage(){
 const s=await createClient(); const {data:{user}}=await s.auth.getUser(); if(!user)redirect('/');
 const {data:me}=await s.from('profiles').select('full_name,role,status').eq('id',user.id).single(); if(!me||me.role!=='admin'||me.status!=='active')redirect('/');
 const [{data:courses},{data:materials},{data:products}]=await Promise.all([
   s.from('courses').select('id,title,slug,type,status,product_id,products(name),created_at').order('created_at',{ascending:false}),
   s.from('materials').select('id,title,type,status,product_id,products(name),created_at').order('created_at',{ascending:false}).limit(100),
   s.from('products').select('id,name,status').order('created_at',{ascending:false})
 ]);
 return <PlatformShell role="admin" name={me.full_name||'Administrador'}>
   <PageHeader eyebrow="FORMACIÓN & RECURSOS" title="Enseñanza y herramientas" description="Administra la formación general y los recursos que utilizan los afiliados." action={<Link className="native-secondary" href="/admin"><ArrowRight size={15}/> Centro de mando</Link>}/>
   <div className="kpi-grid three"><KpiCard label="Cursos" value={String(courses?.length??0)} helper="Formación creada" accent="blue"/><KpiCard label="Materiales" value={String(materials?.length??0)} helper="Recursos disponibles" accent="yellow"/><KpiCard label="Productos" value={String(products?.length??0)} helper="Base del ecosistema" accent="green"/></div>
   <div className="admin-section-tabs"><Link className="active" href="/admin/formacion#academia">Academia</Link><Link href="/admin/estrategias">Cómo vender</Link><Link href="/admin/formacion/recursos">Recursos</Link></div>
   <section id="academia" className="panel-card" style={{marginTop:16}}><div className="panel-heading"><div><span className="section-kicker">ACADEMIA</span><h2>Cursos</h2></div><Link className="native-primary" href="/admin/formacion/nuevo"><Plus size={15}/> Crear curso</Link></div>
     {!courses?.length?<EmptyState icon={<BookOpen size={20}/>} title="Sin cursos todavía" description="Crea el primer curso general o específico por producto."/>:<div className="admin-mini-grid">{courses.map((c:any)=><article key={c.id} className="admin-resource-card"><div className="admin-resource-icon"><BookOpen size={18}/></div><div><strong>{c.title}</strong><span>{c.type==='product_specific'?(c.products?.name||'Producto específico'):'General'}</span></div><div style={{display:'flex',alignItems:'center',gap:7}}><b>{c.status}</b><Link className="native-secondary" href={`/admin/formacion/curso/${c.id}`}><Settings2 size={14}/> Gestionar</Link></div></article>)}</div>}
   </section>
   <section id="recursos" className="panel-card" style={{marginTop:16}}><div className="panel-heading"><div><span className="section-kicker">RECURSOS</span><h2>Materiales</h2></div><Link className="native-primary" href="/admin/formacion/recursos#nuevo-recurso"><Plus size={15}/> Añadir recurso</Link></div>{!materials?.length?<EmptyState icon={<FileImage size={20}/>} title="Sin materiales todavía" description="Los recursos promocionales aparecerán aquí cuando sean publicados."/>:<div className="admin-mini-grid">{materials.slice(0,30).map((m:any)=><article key={m.id} className="admin-resource-card"><div className="admin-resource-icon"><FileImage size={18}/></div><div><strong>{m.title}</strong><span>{m.products?.name||'General'} · {m.type}</span></div><b>{m.status}</b></article>)}</div>}</section>
 </PlatformShell>
}
