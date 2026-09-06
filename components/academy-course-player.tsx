'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BarChart3, Check, CheckCircle2, CircleHelp, Clock, GripVertical, LockKeyhole, RotateCcw, Sparkles, Target, Trophy, Volume2, VolumeX, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

type Lesson={id:string;title:string;content:string|null;lesson_type:string;estimated_minutes:number;objective:string|null;key_points:string[];interactive_data:any;position:number;status:string};
type Module={id:string;title:string;description:string|null;position:number;estimated_minutes:number;icon:string|null;required_previous_module_id:string|null;lessons:Lesson[]};
type Course={id:string;title:string;slug:string;description:string|null;modules:Module[]};

function playTone(kind:'tap'|'success',enabled:boolean){if(!enabled||typeof window==='undefined')return;try{const A=window.AudioContext||(window as any).webkitAudioContext;if(!A)return;const c=new A(),o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=kind==='success'?740:420;g.gain.value=.025;o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+(kind==='success'?.16:.08));}catch{}}
const arraysEqual=(a:any,b:any)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>String(v)===String(b[i]));

export default function AcademyCoursePlayer({course,initialCompleted,initialLessonId}:{course:Course;initialCompleted:string[];initialLessonId?:string|null}){
 const allLessons=useMemo(()=>course.modules.flatMap(m=>m.lessons),[course.modules]);
 const firstPending=allLessons.findIndex(l=>!initialCompleted.includes(l.id));
 const initialFlat=initialLessonId?Math.max(0,allLessons.findIndex(l=>l.id===initialLessonId)):Math.max(0,firstPending<0?allLessons.length-1:firstPending);
 const initialModule=Math.max(0,course.modules.findIndex(m=>m.lessons.some(l=>l.id===allLessons[initialFlat]?.id)));
 const initialLesson=Math.max(0,course.modules[initialModule]?.lessons.findIndex(l=>l.id===allLessons[initialFlat]?.id)??0);
 const[completed,setCompleted]=useState(initialCompleted);const[moduleIndex,setModuleIndex]=useState(initialModule);const[lessonIndex,setLessonIndex]=useState(initialLesson);const[answer,setAnswer]=useState<number|null>(null);const[sequence,setSequence]=useState<number[]>([]);const[pairs,setPairs]=useState<(number|null)[]>([]);const[classification,setClassification]=useState<string[]>([]);const[checks,setChecks]=useState<boolean[]>([]);const[fields,setFields]=useState<string[]>([]);const[sound,setSound]=useState(true);const[busy,setBusy]=useState(false);const[notice,setNotice]=useState('');const[showContents,setShowContents]=useState(true);
 const currentModule=course.modules[moduleIndex];const currentLesson=currentModule?.lessons[lessonIndex];const data=currentLesson?.interactive_data||{};const total=allLessons.length;const currentFlat=currentLesson?allLessons.findIndex(l=>l.id===currentLesson.id):-1;const fieldCount=Array.isArray(data.fields)?data.fields.length:0;
 const moduleComplete=(i:number)=>Boolean(course.modules[i]?.lessons.length)&&course.modules[i].lessons.every(l=>completed.includes(l.id));
 const moduleUnlocked=(i:number)=>i===0||moduleComplete(i-1);
 const lessonUnlocked=(m:number,l:number)=>moduleUnlocked(m)&&(l===0||course.modules[m]?.lessons.slice(0,l).every(x=>completed.includes(x.id))===true);
 const pct=Math.round((completed.filter(id=>allLessons.some(l=>l.id===id)).length/Math.max(total,1))*100);
 useEffect(()=>{setAnswer(null);setSequence([]);setPairs([]);setClassification([]);setChecks([]);setFields(Array.isArray(data.fields)?data.fields.map(()=> ''):[]);setNotice('')},[currentLesson?.id,fieldCount]);
 useEffect(()=>{try{const raw=localStorage.getItem('rebus_preferences');if(raw){const p=JSON.parse(raw);if(typeof p.interfaceSound==='boolean')setSound(p.interfaceSound)}}catch{}},[]);
 useEffect(()=>{try{const raw=localStorage.getItem('rebus_preferences');const p=raw?JSON.parse(raw):{};localStorage.setItem('rebus_preferences',JSON.stringify({...p,interfaceSound:sound}))}catch{}},[sound]);
 const ready=()=>{
   const t=data.type;
   if(t==='multiple_choice'||t==='builder_choice'||t==='chat_simulation') return answer!==null && answer===Number(data.correctIndex);
   if(t==='sequence') return Array.isArray(sequence) && Array.isArray(data.correctOrder) && arraysEqual(sequence,data.correctOrder);
   if(t==='pairing'){
     const expected=Array.isArray(data.pairs)?data.pairs.length:0;
     return expected>0 && pairs.length===expected && pairs.every((v,i)=>v===i) && new Set(pairs.filter((v):v is number=>v!==null)).size===expected;
   }
   if(t==='classification'){
     const expected=Array.isArray(data.items)?data.items.length:0;
     return expected>0 && classification.length===expected && classification.every((v,i)=>v===data.items[i]?.answer);
   }
   if(t==='checklist'){
     const expected=Array.isArray(data.items)?data.items.length:0;
     return expected>0 && checks.length===expected && checks.every(Boolean);
   }
   if(t==='builder'||t==='planner') return fields.length>0 && fields.every(v=>v.trim().length>=3);
   if(t==='final_builder'){
     const expected=Array.isArray(data.fields)?data.fields.length:0;
     if(!expected || fields.length!==expected) return false;
     const filled=fields.filter(v=>v.trim().length>=3).length;
     const passing=Number(data.passingScore||80);
     return filled/expected*100>=passing;
   }
   if(t==='challenge') return (fields[0]||'').trim().length>=10;
   return true;
 };
 const scoreForLesson=()=>{
   if(data.type==='final_builder' && Array.isArray(data.fields) && data.fields.length){
     return Math.round(fields.filter(v=>v.trim().length>=3).length/data.fields.length*100);
   }
   return 100;
 };
 const payload=()=>{switch(data.type){case'multiple_choice':case'builder_choice':case'chat_simulation':return{selectedIndex:answer};case'sequence':return{selectedOrder:sequence};case'pairing':return{selectedPairs:pairs};case'classification':return{selectedCategories:classification};case'checklist':return{checkedItems:checks};case'builder':case'planner':case'final_builder':case'challenge':return{fields};default:return{}}};
 const friendlyError=(message:string)=>{
   if(message.includes('PREVIOUS_LESSON_REQUIRED')||message.includes('PREVIOUS_MODULE_REQUIRED')) return 'Debes completar correctamente la lección anterior antes de continuar.';
   if(message.includes('INCORRECT_ANSWER')) return 'La respuesta no es correcta. Revísala y vuelve a intentarlo.';
   if(message.includes('LESSON_NOT_AVAILABLE')) return 'Esta lección no está disponible en este momento.';
   if(message.includes('NOT_AUTHENTICATED')) return 'Tu sesión expiró. Inicia sesión nuevamente para continuar.';
   return 'No se pudo guardar tu progreso. Inténtalo nuevamente.';
 };
 async function complete(){if(!currentLesson||completed.includes(currentLesson.id)||busy)return;if(!ready()){setNotice(data.type==='final_builder'?'Necesitas alcanzar el 80% de cumplimiento para superar este reto final.':'Debes resolver correctamente el ejercicio antes de continuar.');playTone('tap',sound);return}setBusy(true);setNotice('');try{const s=createClient();const{error}=await s.rpc('save_lesson_progress',{p_lesson_id:currentLesson.id,p_completed:true,p_score:scoreForLesson(),p_last_answer:payload(),p_time_spent_seconds:Math.max(60,currentLesson.estimated_minutes*60)});if(error)throw error;setCompleted(v=>[...new Set([...v,currentLesson.id])]);const isModuleComplete=course.modules[moduleIndex]?.lessons.every(l=>l.id===currentLesson.id||completed.includes(l.id));setNotice(isModuleComplete&&moduleIndex<course.modules.length-1?'¡Módulo completado! El siguiente módulo ya está desbloqueado.':'¡Lección completada! Puedes continuar con la siguiente.');playTone('success',sound)}catch(e:any){setNotice(friendlyError(String(e?.message||e)));playTone('tap',sound)}finally{setBusy(false)}}
 function go(m:number,l:number){if(!lessonUnlocked(m,l))return;setModuleIndex(m);setLessonIndex(l);setShowContents(false);window.scrollTo({top:0,behavior:'smooth'})}
 function next(){if(!currentLesson||!completed.includes(currentLesson.id))return;const n=allLessons[currentFlat+1];if(!n)return;const mi=course.modules.findIndex(m=>m.lessons.some(l=>l.id===n.id));const li=course.modules[mi].lessons.findIndex(l=>l.id===n.id);go(mi,li)}
 const typeLabel:{[k:string]:string}={multiple_choice:'Selección múltiple',builder_choice:'Selección múltiple',sequence:'Orden correcto',pairing:'Relaciona',classification:'Clasifica',checklist:'Checklist',chat_simulation:'Simulación',builder:'Reto práctico',planner:'Plan de acción',final_builder:'Reto final',challenge:'Desafío'};
 const pairOptions=(data.pairs||[]).map((p:any,i:number)=>({index:i,label:p.consequence||p.feature||p.answer||`Opción ${i+1}`}));
 const categories=Array.from(new Set((data.items||[]).map((x:any)=>x.answer).filter(Boolean))) as string[];
 return <div className="academy-new-shell"><header className="academy-new-header"><Link href="/afiliado/academia" className="academy-new-back"><ArrowLeft size={16}/> Academia</Link><div className="academy-new-header-center"><span>{course.title}</span><strong>{pct}% completado</strong></div><button className="academy-new-sound" onClick={()=>setSound(v=>!v)}>{sound?<Volume2 size={17}/>:<VolumeX size={17}/>}</button></header><div className="academy-new-progress"><i style={{width:`${pct}%`}}/></div>
 <div className="academy-new-layout"><aside className={`academy-new-sidebar ${showContents?'open':''}`}><div className="academy-new-sidebar-head"><span>RUTA DE APRENDIZAJE</span><h2>{course.title}</h2><p>Completa y supera cada lección para avanzar.</p></div>{course.modules.map((m,mi)=>{const unlocked=moduleUnlocked(mi),done=moduleComplete(mi),mp=m.lessons.length?Math.round(m.lessons.filter(l=>completed.includes(l.id)).length/m.lessons.length*100):0;return <div key={m.id} className={`academy-new-module ${unlocked?'':'locked'}`}><button className={`academy-new-module-button ${mi===moduleIndex?'active':''}`} disabled={!unlocked} onClick={()=>go(mi,Math.max(0,m.lessons.findIndex(l=>!completed.includes(l.id))))}><span className="academy-new-module-icon">{done?<CheckCircle2 size={16}/>:unlocked?mi+1:<LockKeyhole size={15}/>}</span><span><strong>{m.icon} {m.title}</strong><small>{mp}% · {m.lessons.length} lecciones</small></span><ArrowRight size={14}/></button>{mi===moduleIndex&&<div className="academy-new-lessons">{m.lessons.map((l,li)=>{const can=lessonUnlocked(mi,li),doneLesson=completed.includes(l.id);return <button key={l.id} disabled={!can} className={`academy-new-lesson ${li===lessonIndex?'active':''} ${doneLesson?'done':''}`} onClick={()=>go(mi,li)}><span>{doneLesson?<CheckCircle2 size={14}/>:can?li+1:<LockKeyhole size={12}/>}</span><span><strong>{l.title}</strong><small>{l.estimated_minutes} min</small></span></button>})}</div>}</div>})}</aside>
 <main className="academy-new-main"><div className="academy-new-breadcrumb"><span>MÓDULO {moduleIndex+1}</span><span>›</span><span>LECCIÓN {lessonIndex+1}</span><span className="academy-new-type">{typeLabel[data.type]||currentLesson?.lesson_type}</span></div><div className="academy-new-hero"><div><span className="academy-new-kicker">LECCIÓN {currentFlat+1} DE {total}</span><h1>{currentLesson?.title}</h1><p>{currentLesson?.content}</p></div><div className="academy-new-hero-meta"><span><Clock size={14}/>{currentLesson?.estimated_minutes} min</span><span>{Math.round(((currentFlat+1)/Math.max(total,1))*100)}% de la ruta</span></div></div>{currentLesson?.objective&&<div className="academy-new-callout"><Target size={18}/><div><strong>Objetivo</strong><p>{currentLesson.objective}</p></div></div>}{!!currentLesson?.key_points?.length&&<div className="academy-new-points">{currentLesson.key_points.map(k=><span key={k}><CheckCircle2 size={13}/>{k}</span>)}</div>}
 {data.type==='multiple_choice'||data.type==='builder_choice'?<section className="academy-new-interaction"><div className="academy-new-interaction-head"><Zap size={16}/><span>RESPONDE PARA CONTINUAR</span></div><h2>{data.question}</h2><div className="academy-new-choice-grid">{(data.options||[]).map((o:string,i:number)=><button key={o} className={`academy-new-choice ${answer===i?'selected':''}`} onClick={()=>setAnswer(i)}><span>{String.fromCharCode(65+i)}</span>{o}{answer===i&&<Check size={16}/>}</button>)}</div></section>:null}
 {data.type==='chat_simulation'?<section className="academy-new-interaction"><div className="academy-new-interaction-head"><CircleHelp size={16}/><span>SIMULACIÓN</span></div><div className="academy-new-chat-customer">{data.customer}</div><div className="academy-new-choice-grid">{(data.responses||[]).map((o:string,i:number)=><button key={o} className={`academy-new-choice ${answer===i?'selected':''}`} onClick={()=>setAnswer(i)}><span>{i+1}</span>{o}</button>)}</div></section>:null}
 {data.type==='sequence'?<section className="academy-new-interaction"><div className="academy-new-interaction-head"><RotateCcw size={16}/><span>ORDENA LA IDEA</span></div><h2>Selecciona los elementos en el orden correcto.</h2><div className="academy-sequence-grid">{(data.items||[]).map((o:string,i:number)=><button key={o} className={`academy-new-choice ${sequence.includes(i)?'selected':''}`} disabled={sequence.includes(i)} onClick={()=>setSequence(v=>[...v,i])}><GripVertical size={15}/><span>{sequence.includes(i)?sequence.indexOf(i)+1:'•'}</span>{o}</button>)}</div>{sequence.length>0&&<button className="academy-clear-action" onClick={()=>setSequence([])}><RotateCcw size={14}/> Reiniciar</button>}<p className="academy-new-answer-preview">{sequence.map(i=>data.items?.[i]).join(' → ')||'Tu orden aparecerá aquí.'}</p></section>:null}
 {data.type==='pairing'?<section className="academy-new-interaction"><div className="academy-new-interaction-head"><BarChart3 size={16}/><span>RELACIONA</span></div><h2>Relaciona cada elemento con su respuesta correcta.</h2><div className="academy-pair-list">{(data.pairs||[]).map((pair:any,i:number)=><label key={i}><span>{pair.problem||pair.benefit||`Elemento ${i+1}`}</span><select value={pairs[i]??''} onChange={e=>{const v=[...pairs];v[i]=e.target.value===''?null:Number(e.target.value);setPairs(v)}}><option value="">Selecciona…</option>{pairOptions.map((x:any)=><option key={x.index} value={x.index}>{x.label}</option>)}</select></label>)}</div></section>:null}
 {data.type==='classification'?<section className="academy-new-interaction"><div className="academy-new-interaction-head"><BarChart3 size={16}/><span>CLASIFICA</span></div><h2>Clasifica todos los elementos correctamente.</h2><div className="academy-pair-list">{(data.items||[]).map((item:any,i:number)=><label key={i}><span>{item.text}</span><select value={classification[i]||''} onChange={e=>{const v=[...classification];v[i]=e.target.value;setClassification(v)}}><option value="">Selecciona…</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></label>)}</div></section>:null}
 {data.type==='checklist'?<section className="academy-new-interaction"><div className="academy-new-interaction-head"><CheckCircle2 size={16}/><span>VERIFICACIÓN</span></div><h2>Confirma que dominas todos estos puntos.</h2><div className="academy-checklist">{(data.items||[]).map((item:string,i:number)=><label key={item}><input type="checkbox" checked={Boolean(checks[i])} onChange={e=>{const v=[...checks];v[i]=e.target.checked;setChecks(v)}}/><span>{item}</span></label>)}</div></section>:null}
 {['builder','planner','final_builder','challenge'].includes(data.type)?<section className="academy-new-interaction"><div className="academy-new-interaction-head"><Sparkles size={16}/><span>{typeLabel[data.type]}</span></div><h2>{data.prompt||data.template||'Completa el ejercicio.'}</h2><div className="academy-new-fields">{(data.fields||['Respuesta']).map((f:string,i:number)=><label key={f}><span>{f}</span><textarea rows={data.fields?.length>3?3:2} value={fields[i]||''} onChange={e=>{const v=[...fields];v[i]=e.target.value;setFields(v)}} placeholder="Escribe tu respuesta…"/></label>)}</div></section>:null}
 <div className="academy-new-actions"><button className="academy-new-btn secondary" disabled={currentFlat<=0} onClick={()=>{if(lessonIndex>0)go(moduleIndex,lessonIndex-1);else if(moduleIndex>0)go(moduleIndex-1,course.modules[moduleIndex-1].lessons.length-1)}}><ArrowLeft size={15}/> Anterior</button>{!completed.includes(currentLesson?.id||'')?<button className="academy-new-btn primary" disabled={busy} onClick={complete}>{busy?'Guardando…':'Comprobar y completar'} <CheckCircle2 size={16}/></button>:currentFlat<total-1?<button className="academy-new-btn primary" onClick={next}>Siguiente lección <ArrowRight size={16}/></button>:<Link href="/afiliado/academia" className="academy-new-btn primary">Curso completado <Trophy size={16}/></Link>}</div>{notice&&<div className={`academy-new-notice ${notice.includes('correcta')?'success':''}`}>{notice}</div>}{pct===100&&<div className="academy-new-complete"><Trophy size={22}/><div><strong>Curso completado</strong><span>Has completado todas las lecciones de {course.title}.</span></div></div>}</main></div></div>;
}
