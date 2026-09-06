'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronDown, ChevronRight, FileText, Plus, Save, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

type Course = { id:string; title:string; slug:string; description:string; type:string; status:string; product_id:string|null };
type Module = { id:string; course_id:string; title:string; slug:string; description:string|null; position:number; estimated_minutes:number; status:string };
type Lesson = { id:string; module_id:string; title:string; content:string; lesson_type:string; estimated_minutes:number; objective:string|null; position:number; status:string };

export default function AdminAcademyManager({initialCourse}:{initialCourse:Course}) {
  const supabase = useMemo(()=>createClient(), []);
  const [course,setCourse]=useState(initialCourse);
  const [modules,setModules]=useState<Module[]>([]);
  const [lessons,setLessons]=useState<Lesson[]>([]);
  const [open,setOpen]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState('');

  useEffect(()=>{ load(); },[]);
  async function load(){
    const [{data:m},{data:l}]=await Promise.all([
      supabase.from('course_modules').select('id,course_id,title,slug,description,position,estimated_minutes,status').eq('course_id',course.id).order('position',{ascending:true}),
      supabase.from('lessons').select('id,module_id,title,content,lesson_type,estimated_minutes,objective,position,status').eq('course_id',course.id).order('position',{ascending:true}),
    ]);
    setModules(m||[]); setLessons(l||[]);
    if ((m||[]).length) setOpen(m![0].id);
  }
  async function saveCourse(){
    setSaving(true); setNotice('');
    const {error}=await supabase.from('courses').update({title:course.title,slug:course.slug,description:course.description,type:course.type,status:course.status}).eq('id',course.id);
    setNotice(error?error.message:'Curso actualizado correctamente.'); setSaving(false);
  }
  async function addModule(){
    const position = modules.length+1;
    const slug=`modulo-${position}`;
    const {data,error}=await supabase.from('course_modules').insert({course_id:course.id,title:`Nuevo módulo ${position}`,slug,description:'Descripción del módulo.',position,estimated_minutes:15,status:'draft'}).select().single();
    if(error){setNotice(error.message);return;} if(data){setModules(v=>[...v,data]);setOpen(data.id);setNotice('Módulo creado.');}
  }
  async function saveModule(m:Module){
    const {error}=await supabase.from('course_modules').update({title:m.title,slug:m.slug,description:m.description,estimated_minutes:m.estimated_minutes,status:m.status}).eq('id',m.id);
    setNotice(error?error.message:'Módulo guardado.');
  }
  async function deleteModule(id:string){
    if(!confirm('¿Eliminar este módulo y sus lecciones?')) return;
    const {error}=await supabase.from('course_modules').delete().eq('id',id);
    if(error){setNotice(error.message);return;} setModules(v=>v.filter(x=>x.id!==id));setLessons(v=>v.filter(x=>x.module_id!==id));setNotice('Módulo eliminado.');
  }
  async function addLesson(m:Module){
    const moduleLessons=lessons.filter(l=>l.module_id===m.id);
    const position=moduleLessons.length+1;
    const {data,error}=await supabase.from('lessons').insert({course_id:course.id,module_id:m.id,title:`Nueva lección ${position}`,content:'Contenido pendiente de edición.',lesson_type:'interactive',estimated_minutes:7,objective:'Define el objetivo de aprendizaje.',position,status:'draft'}).select().single();
    if(error){setNotice(error.message);return;} if(data){setLessons(v=>[...v,data]);setNotice('Lección creada.');}
  }
  async function saveLesson(l:Lesson){
    const {error}=await supabase.from('lessons').update({title:l.title,content:l.content,lesson_type:l.lesson_type,estimated_minutes:l.estimated_minutes,objective:l.objective,status:l.status}).eq('id',l.id);
    setNotice(error?error.message:'Lección guardada.');
  }
  async function deleteLesson(id:string){
    if(!confirm('¿Eliminar esta lección?')) return;
    const {error}=await supabase.from('lessons').delete().eq('id',id);
    if(error){setNotice(error.message);return;} setLessons(v=>v.filter(x=>x.id!==id));setNotice('Lección eliminada.');
  }

  return <div className="academy-admin-manager">
    {notice && <div className="academy-admin-notice"><CheckCircle2 size={16}/>{notice}</div>}
    <section className="panel-card academy-admin-course-editor">
      <div className="panel-heading"><div><span className="section-kicker">CURSO</span><h2>Configuración general</h2></div><BookOpen size={18}/></div>
      <div className="academy-admin-form-grid">
        <label><span>Nombre</span><input value={course.title} onChange={e=>setCourse({...course,title:e.target.value})}/></label>
        <label><span>Slug</span><input value={course.slug} onChange={e=>setCourse({...course,slug:e.target.value})}/></label>
        <label className="full"><span>Descripción</span><textarea value={course.description} onChange={e=>setCourse({...course,description:e.target.value})}/></label>
        <label><span>Tipo</span><select value={course.type} onChange={e=>setCourse({...course,type:e.target.value})}><option value="general">General</option><option value="product_specific">Producto específico</option></select></label>
        <label><span>Estado</span><select value={course.status} onChange={e=>setCourse({...course,status:e.target.value})}><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></select></label>
      </div>
      <button className="native-primary" disabled={saving} onClick={saveCourse}><Save size={15}/>{saving?'Guardando…':'Guardar curso'}</button>
    </section>

    <section className="panel-card" style={{marginTop:16}}>
      <div className="panel-heading"><div><span className="section-kicker">ESTRUCTURA</span><h2>Módulos y lecciones</h2></div><button className="native-secondary" onClick={addModule}><Plus size={15}/> Nuevo módulo</button></div>
      <div className="academy-admin-module-list">
        {modules.map(m=>{
          const ls=lessons.filter(l=>l.module_id===m.id).sort((a,b)=>a.position-b.position);
          const expanded=open===m.id;
          return <article key={m.id} className={`academy-admin-module ${expanded?'expanded':''}`}>
            <button className="academy-admin-module-head" onClick={()=>setOpen(expanded?null:m.id)}><span className="academy-admin-module-index">{m.position}</span><span><strong>{m.title}</strong><small>{ls.length} lecciones · {m.estimated_minutes} min · {m.status}</small></span>{expanded?<ChevronDown size={17}/>:<ChevronRight size={17}/>}</button>
            {expanded && <div className="academy-admin-module-body">
              <div className="academy-admin-form-grid">
                <label><span>Título</span><input value={m.title} onChange={e=>setModules(v=>v.map(x=>x.id===m.id?{...x,title:e.target.value}:x))}/></label>
                <label><span>Slug</span><input value={m.slug} onChange={e=>setModules(v=>v.map(x=>x.id===m.id?{...x,slug:e.target.value}:x))}/></label>
                <label className="full"><span>Descripción</span><textarea value={m.description||''} onChange={e=>setModules(v=>v.map(x=>x.id===m.id?{...x,description:e.target.value}:x))}/></label>
              </div>
              <div className="academy-admin-row-actions"><button className="native-secondary" onClick={()=>saveModule(m)}><Save size={14}/> Guardar módulo</button><button className="danger-ghost" onClick={()=>deleteModule(m.id)}><Trash2 size={14}/> Eliminar</button><button className="native-secondary" onClick={()=>addLesson(m)}><Plus size={14}/> Nueva lección</button></div>
              <div className="academy-admin-lessons">
                {ls.map(l=><div key={l.id} className="academy-admin-lesson-card">
                  <div className="academy-admin-lesson-icon"><FileText size={15}/></div>
                  <div className="academy-admin-lesson-editor">
                    <label><span>Título</span><input value={l.title} onChange={e=>setLessons(v=>v.map(x=>x.id===l.id?{...x,title:e.target.value}:x))}/></label>
                    <label><span>Contenido</span><textarea value={l.content} onChange={e=>setLessons(v=>v.map(x=>x.id===l.id?{...x,content:e.target.value}:x))}/></label>
                    <div className="academy-admin-inline-grid"><label><span>Tipo</span><select value={l.lesson_type} onChange={e=>setLessons(v=>v.map(x=>x.id===l.id?{...x,lesson_type:e.target.value}:x))}><option value="content">Contenido</option><option value="interactive">Interactiva</option><option value="quiz">Quiz</option><option value="scenario">Escenario</option><option value="challenge">Reto</option><option value="simulation">Simulación</option><option value="final_challenge">Reto final</option></select></label><label><span>Minutos</span><input type="number" value={l.estimated_minutes} onChange={e=>setLessons(v=>v.map(x=>x.id===l.id?{...x,estimated_minutes:Number(e.target.value)}:x))}/></label><label><span>Estado</span><select value={l.status} onChange={e=>setLessons(v=>v.map(x=>x.id===l.id?{...x,status:e.target.value}:x))}><option value="draft">Borrador</option><option value="published">Publicado</option></select></label></div>
                    <div className="academy-admin-row-actions"><button className="native-secondary" onClick={()=>saveLesson(l)}><Save size={13}/> Guardar lección</button><button className="danger-ghost" onClick={()=>deleteLesson(l.id)}><Trash2 size={13}/> Eliminar</button></div>
                  </div>
                </div>)}
                {!ls.length && <div className="empty-state compact"><FileText size={18}/><h3>Sin lecciones</h3><p>Crea la primera lección de este módulo.</p></div>}
              </div>
            </div>}
          </article>
        })}
        {!modules.length && <div className="empty-state"><BookOpen size={20}/><h3>Este curso aún no tiene módulos</h3><p>Crea el primer módulo para comenzar a construir la ruta.</p></div>}
      </div>
    </section>
  </div>
}
