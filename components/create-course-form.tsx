'use client';
import { useState } from 'react';
import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
export default function CreateCourseForm(){
 const r=useRouter(); const s=createClient(); const [form,setForm]=useState({title:'',slug:'',description:'',type:'general',status:'draft'}); const [msg,setMsg]=useState(''); const [busy,setBusy]=useState(false);
 async function create(){setBusy(true);setMsg(''); if(!form.title||!form.slug){setMsg('Completa nombre y slug.');setBusy(false);return;} const {data,error}=await s.from('courses').insert(form).select('id').single(); if(error){setMsg(error.message);setBusy(false);return;} r.push(`/admin/formacion/curso/${data.id}`);}
 return <section className="panel-card academy-admin-course-editor"><div className="academy-admin-form-grid"><label><span>Nombre del curso</span><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label><span>Slug</span><input value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})}/></label><label className="full"><span>Descripción</span><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label><span>Tipo</span><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="general">General</option><option value="product_specific">Producto específico</option></select></label><label><span>Estado inicial</span><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">Borrador</option><option value="published">Publicado</option></select></label></div>{msg&&<p style={{color:'#a04354',fontSize:12}}>{msg}</p>}<button className="native-primary" onClick={create} disabled={busy}><Save size={15}/>{busy?'Creando…':'Crear curso'}</button></section>
}
