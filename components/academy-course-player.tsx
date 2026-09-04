'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, Clock, LockKeyhole, Sparkles, Target, Trophy, Volume2, VolumeX, Zap, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

type Lesson = { id:string; title:string; content:string|null; lesson_type:string; estimated_minutes:number; objective:string|null; key_points:string[]; interactive_data:any; position:number; status:string };
type Module = { id:string; title:string; description:string|null; position:number; estimated_minutes:number; icon:string|null; required_previous_module_id:string|null; lessons:Lesson[] };
type Course = { id:string; title:string; slug:string; description:string|null; modules:Module[] };

function playTone(kind:'tap'|'success', enabled:boolean){
  if(!enabled || typeof window==='undefined') return;
  try{ const AudioCtx=window.AudioContext || (window as any).webkitAudioContext; if(!AudioCtx)return; const ctx=new AudioCtx(); const osc=ctx.createOscillator(); const gain=ctx.createGain(); osc.type='sine'; osc.frequency.value=kind==='success'?740:520; gain.gain.value=.035; osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime+(kind==='success'?.16:.08)); }catch{}
}

export default function AcademyCoursePlayer({ course, initialCompleted, initialLessonId }: { course:Course; initialCompleted:string[]; initialLessonId?:string|null }) {
  const allLessons=useMemo(()=>course.modules.flatMap(m=>m.lessons),[course.modules]);
  const initialLessonIndex=Math.max(0, allLessons.findIndex(l=>l.id===initialLessonId));
  const initialModuleIndex=Math.max(0, course.modules.findIndex(m=>m.lessons.some(l=>l.id===allLessons[initialLessonIndex]?.id)));
  const [completed,setCompleted]=useState(initialCompleted);
  const [moduleIndex,setModuleIndex]=useState(initialModuleIndex);
  const [lessonIndex,setLessonIndex]=useState(Math.max(0, course.modules[initialModuleIndex]?.lessons.findIndex(l=>l.id===initialLessonId) ?? 0));
  const [answer,setAnswer]=useState<number|null>(null);
  const [draft,setDraft]=useState('');
  const [sound,setSound]=useState(true);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [showLessonList,setShowLessonList]=useState(false);
  const currentModule=course.modules[moduleIndex];
  const currentLesson=currentModule?.lessons[lessonIndex];
  const total=allLessons.length;
  const overall=Math.round((completed.filter(id=>allLessons.some(l=>l.id===id)).length/Math.max(total,1))*100);
  const currentFlatIndex=currentLesson?allLessons.findIndex(l=>l.id===currentLesson.id):-1;
  const moduleComplete=(i:number)=>Boolean(course.modules[i]?.lessons.length) && course.modules[i].lessons.every(l=>completed.includes(l.id));
  const moduleUnlocked=(i:number)=>i === 0 || moduleComplete(i-1);
  const lessonUnlocked=(m:number,l:number)=>{
    if (!moduleUnlocked(m)) return false;
    if (l === 0) return true;
    return course.modules[m]?.lessons.slice(0,l).every(lesson => completed.includes(lesson.id)) ?? false;
  };
  const data=currentLesson?.interactive_data || {};

  useEffect(()=>{ setAnswer(null); setDraft(''); setNotice(''); },[moduleIndex,lessonIndex]);
  useEffect(()=>{
    try {
      const raw=window.localStorage.getItem('rebus_preferences');
      if(raw){ const prefs=JSON.parse(raw); if(typeof prefs.interfaceSound==='boolean') setSound(prefs.interfaceSound); }
    } catch {}
  },[]);
  useEffect(()=>{
    try {
      const raw=window.localStorage.getItem('rebus_preferences');
      const prefs=raw?JSON.parse(raw):{};
      window.localStorage.setItem('rebus_preferences',JSON.stringify({...prefs,interfaceSound:sound}));
    } catch {}
  },[sound]);

  async function completeCurrent(){
    if(!currentLesson || completed.includes(currentLesson.id) || busy) return;
    setBusy(true); setNotice('');
    const supabase=createClient();
    const isQuiz=['quiz','scenario'].includes(currentLesson.lesson_type);
    if(isQuiz && data?.correctIndex!=null && answer!==data.correctIndex){ setNotice('Revisa tu respuesta y vuelve a intentarlo.'); setBusy(false); playTone('tap',sound); return; }
    try{
      const {data:{user}}=await supabase.auth.getUser(); if(!user) throw new Error('Sesión no disponible');
      const {error}=await supabase.rpc('save_lesson_progress',{p_lesson_id:currentLesson.id,p_completed:true,p_score:isQuiz?100:null,p_last_answer:answer==null?{}:{selectedIndex:answer},p_time_spent_seconds:Math.max(60,currentLesson.estimated_minutes*60)});
      if(error) throw error;
      const next=[...completed,currentLesson.id]; setCompleted(next); setNotice('¡Lección completada! El siguiente paso ya está disponible.'); playTone('success',sound);
    }catch(e:any){ setNotice(e?.message||'No se pudo guardar el progreso.'); playTone('tap',sound); } finally{setBusy(false);}
  }

  function navigateTo(m:number,l:number){ if(!lessonUnlocked(m,l)) return; setModuleIndex(m); setLessonIndex(l); setShowLessonList(false); window.scrollTo({top:0,behavior:'smooth'}); }
  function goNext(){
    if(!currentLesson || !completed.includes(currentLesson.id)) return;
    const globalNext=allLessons[currentFlatIndex+1];
    if(!globalNext) return;
    const nextModuleIndex=course.modules.findIndex(m=>m.lessons.some(l=>l.id===globalNext.id));
    const nextLessonIndex=course.modules[nextModuleIndex].lessons.findIndex(l=>l.id===globalNext.id);
    if(lessonUnlocked(nextModuleIndex,nextLessonIndex)) navigateTo(nextModuleIndex,nextLessonIndex);
  }
  const progressLabel=`${completed.filter(id=>allLessons.some(l=>l.id===id)).length} de ${total} lecciones`;
  const pctModule=currentModule?.lessons.length ? Math.round(currentModule.lessons.filter(l=>completed.includes(l.id)).length/currentModule.lessons.length*100) : 0;

  return <div className="academy-player-wrap">
    <div className="academy-player-topbar">
      <Link href="/afiliado/academia" className="academy-back-link"><ArrowLeft size={16}/> Academia</Link>
      <div className="academy-player-top-progress"><span>{overall}%</span><div><i style={{width:`${overall}%`}}/></div><small>{progressLabel}</small></div>
      <button className="academy-sound-btn" onClick={()=>setSound(v=>!v)} aria-label="Sonido">{sound?<Volume2 size={17}/>:<VolumeX size={17}/>}</button>
    </div>

    <div className="academy-course-journey-summary"><div><span>MÓDULO {moduleIndex+1} DE {course.modules.length}</span><strong>{currentModule?.title}</strong><small>{pctModule}% completado</small></div><button onClick={()=>setShowLessonList(v=>!v)}>{showLessonList?'Ocultar contenido':'Ver contenido'} <ChevronRight size={15}/></button></div>

    <div className="academy-player-grid">
      <aside className={`academy-module-nav ${showLessonList?'is-open':''}`}>
        <div className="academy-module-nav-head"><span>CONTENIDO DEL CURSO</span><strong>{course.title}</strong><small>Completa todas las lecciones de un módulo para desbloquear el siguiente.</small></div>
        {course.modules.map((m,i)=>{ const unlocked=moduleUnlocked(i); const done=m.lessons.length>0&&m.lessons.every(l=>completed.includes(l.id)); const modPct=m.lessons.length?Math.round(m.lessons.filter(l=>completed.includes(l.id)).length/m.lessons.length*100):0; return <div key={m.id} className="academy-module-block">
          <button disabled={!unlocked} className={`academy-module-nav-item ${i===moduleIndex?'active':''} ${done?'done':''}`} onClick={()=>unlocked&&navigateTo(i,Math.max(0,m.lessons.findIndex(l=>!completed.includes(l.id))))}>
            <span className="academy-module-num">{done?<CheckCircle2 size={16}/>:unlocked?String(i+1):<LockKeyhole size={15}/>}</span><span><strong>{m.icon} {m.title}</strong><small>{modPct}% · {m.lessons.length} lecciones</small></span><ChevronRight size={16}/>
          </button>
          {i===moduleIndex && <div className="academy-lesson-list">{m.lessons.map((lesson,li)=>{ const isDone=completed.includes(lesson.id); const unlockedLesson=lessonUnlocked(i,li); return <button key={lesson.id} disabled={!unlockedLesson} className={`academy-lesson-nav-item ${li===lessonIndex?'active':''} ${isDone?'done':''}`} onClick={()=>navigateTo(i,li)}><span>{isDone?<CheckCircle2 size={14}/>:unlockedLesson?li+1:<LockKeyhole size={12}/>}</span><span><strong>{lesson.title}</strong><small>{lesson.estimated_minutes} min</small></span></button>;})}</div>}
        </div>})}
      </aside>

      <main className="academy-lesson-stage">
        <div className="academy-lesson-meta"><span>MÓDULO {moduleIndex+1} · LECCIÓN {lessonIndex+1}</span><span><Clock size={14}/>{currentLesson?.estimated_minutes} min</span><span>{currentLesson?.lesson_type}</span></div>
        <div className="academy-lesson-path"><span>{currentFlatIndex+1}</span><div><i style={{width:`${Math.max(0,((currentFlatIndex)/Math.max(total-1,1))*100)}%`}}/></div><small>paso {currentFlatIndex+1} de {total}</small></div>
        <h1>{currentLesson?.title}</h1>
        <p className="academy-lesson-intro">{currentLesson?.content}</p>

        {currentLesson?.objective && <div className="academy-callout"><Target size={18}/><div><strong>Objetivo de hoy</strong><p>{currentLesson.objective}</p></div></div>}
        {!!currentLesson?.key_points?.length && <div className="academy-keypoints">{currentLesson.key_points.map(k=><span key={k}><CheckCircle2 size={12}/>{k}</span>)}</div>}

        {(data.type==='multiple_choice' || data.type==='builder_choice') && <section className="academy-interaction-card"><div className="academy-interaction-kicker"><Zap size={15}/> PRUEBA RÁPIDA</div><h2>{data.question}</h2><div className="academy-options">{(data.options||[]).map((o:string,i:number)=>{const chosen=answer===i; const correct=completed.includes(currentLesson!.id)&&i===data.correctIndex; return <button key={o} className={`academy-option ${chosen?'selected':''} ${correct?'correct':''}`} onClick={()=>{setAnswer(i);playTone('tap',sound)}}><span>{String.fromCharCode(65+i)}</span>{o}{correct&&<CheckCircle2 size={16}/>}</button>})}</div></section>}

        {(data.type==='builder' || data.type==='planner' || data.type==='final_builder') && <section className="academy-interaction-card"><div className="academy-interaction-kicker"><Sparkles size={15}/> RETO PRÁCTICO</div><h2>Construye tu respuesta</h2><div className="academy-builder-fields">{(data.fields||[]).map((f:string,i:number)=><label key={f}><span>{f}</span><input value={i===0?draft:''} onChange={e=>setDraft(e.target.value)} placeholder={`Escribe ${f.toLowerCase()}...`} /></label>)}</div><p className="academy-challenge-help">No necesitas una respuesta perfecta. El objetivo es llevar la idea a tu contexto real.</p></section>}

        {data.type==='sequence' && <section className="academy-interaction-card"><div className="academy-interaction-kicker"><RotateCcw size={15}/> ORDENA LA IDEA</div><h2>Construye una secuencia en el orden que usarías para vender.</h2><div className="academy-options">{(data.items||[]).map((o:string,i:number)=><button key={o} className="academy-option" onClick={()=>setDraft(d=>d?`${d} → ${o}`:o)}><span>{i+1}</span>{o}</button>)}</div><p className="academy-draft-output">{draft||'Tu secuencia aparecerá aquí.'}</p><button className="academy-clear-draft" onClick={()=>setDraft('')}>Limpiar</button></section>}

        {data.type==='chat_simulation' && <section className="academy-interaction-card"><div className="academy-interaction-kicker"><Target size={15}/> SIMULACIÓN</div><div className="academy-chat"><div className="academy-chat-bubble customer">{data.customer}</div>{(data.responses||[]).map((o:string,i:number)=><button key={o} className={`academy-option ${answer===i?'selected':''}`} onClick={()=>setAnswer(i)}><span>{i+1}</span>{o}</button>)}</div></section>}

        <div className="academy-lesson-actions">
          <button className="academy-secondary-btn" onClick={()=>{if(lessonIndex>0)navigateTo(moduleIndex,lessonIndex-1);else if(moduleIndex>0){const pm=course.modules[moduleIndex-1];navigateTo(moduleIndex-1,Math.max(0,pm.lessons.length-1));}}}><ArrowLeft size={15}/> Anterior</button>
          {!completed.includes(currentLesson?.id||'') && <button className="academy-primary-btn" disabled={busy} onClick={completeCurrent}>{busy?'Guardando…':'Completar lección'} <CheckCircle2 size={16}/></button>}
          {completed.includes(currentLesson?.id||'') && currentFlatIndex<total-1 && <button className="academy-primary-btn" onClick={goNext}>Siguiente <ArrowRight size={16}/></button>}
          {completed.includes(currentLesson?.id||'') && currentFlatIndex===total-1 && <Link href="/afiliado/academia" className="academy-primary-btn">Volver a la Academia <Trophy size={16}/></Link>}
        </div>

        {notice && <div className={`academy-player-notice ${notice.includes('completada')?'success':''}`}><Sparkles size={15}/>{notice}</div>}
        {overall===100 && <div className="academy-complete-banner"><Trophy size={24}/><div><strong>Ruta completada</strong><p>Terminaste {course.title}. Tu progreso quedó guardado.</p></div><Link href="/afiliado/academia">Ver siguiente nivel <ArrowRight size={14}/></Link></div>}
      </main>
    </div>
  </div>;
}
