import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, PageHeader } from '@/components/platform-shell';
import AdminAcademyManager from '@/components/admin-academy-manager';

export const dynamic='force-dynamic';

export default async function AdminCourseManager({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const s=await createClient();
  const {data:{user}}=await s.auth.getUser(); if(!user)redirect('/');
  const {data:me}=await s.from('profiles').select('full_name,role,status').eq('id',user.id).single();
  if(!me||me.role!=='admin'||me.status!=='active')redirect('/');
  const {data:course}=await s.from('courses').select('id,title,slug,description,type,status,product_id').eq('id',id).single();
  if(!course)notFound();
  return <PlatformShell role="admin" name={me.full_name||'Administrador'}>
    <PageHeader eyebrow="FORMACIÓN & RECURSOS" title={course.title} description="Gestiona el contenido que posteriormente consumirá el afiliado desde Academia." action={<Link className="native-secondary" href="/admin/formacion"><ArrowLeft size={15}/> Formación & Recursos</Link>}/>
    <AdminAcademyManager initialCourse={course}/>
  </PlatformShell>;
}
