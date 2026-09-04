import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, PageHeader } from '@/components/platform-shell';
import CreateCourseForm from '@/components/create-course-form';
export const dynamic='force-dynamic';
export default async function NewCoursePage(){
 const s=await createClient(); const {data:{user}}=await s.auth.getUser(); if(!user)redirect('/');
 const {data:me}=await s.from('profiles').select('full_name,role,status').eq('id',user.id).single(); if(!me||me.role!=='admin'||me.status!=='active')redirect('/');
 return <PlatformShell role="admin" name={me.full_name||'Administrador'}><PageHeader eyebrow="ACADEMIA" title="Crear curso" description="Crea la estructura base y luego construye sus módulos y lecciones." action={<Link className="native-secondary" href="/admin/formacion"><ArrowLeft size={15}/> Volver</Link>}/><CreateCourseForm/></PlatformShell>
}
