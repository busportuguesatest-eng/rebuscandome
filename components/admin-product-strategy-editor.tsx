'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Save, Sparkles } from 'lucide-react';

const fields = [
  ['audience','Cliente ideal'],
  ['problem','Problema principal'],
  ['transformation','Transformación / promesa'],
  ['benefits','Beneficios clave'],
  ['angles','Ángulos de venta'],
  ['hooks','Hooks recomendados'],
  ['objections','Objeciones y respuestas'],
  ['whatsapp','WhatsApp / conversación'],
  ['instagram','Instagram'],
  ['tiktok','TikTok'],
  ['ads','Publicidad'],
  ['salesStrategy','Ruta / estrategia comercial'],
] as const;

export function AdminProductStrategyEditor({ productId, productName, initialData }:{productId:string;productName:string;initialData:Record<string,unknown>}){
  const [data,setData]=useState<Record<string,string>>(()=>Object.fromEntries(fields.map(([k])=>[k,String(initialData?.[k]??'')])));
  const [saving,setSaving]=useState(false); const [saved,setSaved]=useState(false); const [error,setError]=useState('');
  useEffect(()=>{ setData(Object.fromEntries(fields.map(([k])=>[k,String(initialData?.[k]??'')]))); },[initialData]);
  async function save(){
    setSaving(true);setSaved(false);setError('');
    try{ const r=await fetch(`/api/admin/products/${productId}/strategy`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); const p=await r.json().catch(()=>({})); if(!r.ok) throw new Error(p.error||'No se pudo guardar.'); setSaved(true); setTimeout(()=>setSaved(false),1800); }
    catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}
    finally{setSaving(false)}
  }
  return <div className="strategy-editor-wrap"><div className="strategy-editor-note"><Sparkles size={17}/><div><strong>Fuente de verdad del Centro de Venta</strong><p>Lo que guardes aquí se muestra al afiliado dentro del producto seleccionado.</p></div></div><div className="strategy-editor-grid">{fields.map(([key,label])=><label key={key}><span>{label}</span><textarea value={data[key]} onChange={e=>setData(d=>({...d,[key]:e.target.value}))} placeholder={`Configura ${label.toLowerCase()} para ${productName}.`} /></label>)}</div>{error&&<div className="native-error">{error}</div>}<div className="strategy-editor-actions"><span>{saved?'Guardado en Supabase':'Puedes actualizar esta estrategia cuando quieras.'}</span><button className="native-primary" onClick={save} disabled={saving}>{saving?<><Loader2 size={15} className="spin"/> Guardando…</>:saved?<><Check size={15}/> Guardado</>:<><Save size={15}/> Guardar estrategia</>}</button></div></div>
}
