'use client';

import { Bell, BookOpenCheck, CheckCircle2, Save, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';

type Preferences = { salesAlerts:boolean; trainingReminders:boolean; interfaceSound:boolean };
const defaults:Preferences={salesAlerts:true,trainingReminders:true,interfaceSound:true};

export default function AffiliatePreferences(){
  const [prefs,setPrefs]=useState<Preferences>(defaults); const [saved,setSaved]=useState(false);
  useEffect(()=>{try{const raw=window.localStorage.getItem('rebus_preferences');if(raw)setPrefs({...defaults,...JSON.parse(raw)})}catch{}},[]);
  function toggle(key:keyof Preferences){setPrefs(v=>({...v,[key]:!v[key]}));setSaved(false)}
  function save(){try{window.localStorage.setItem('rebus_preferences',JSON.stringify(prefs));setSaved(true);window.setTimeout(()=>setSaved(false),2200)}catch{}}
  return <>
    <section className="preferences-card">
      <button type="button" className="preference-row" onClick={()=>toggle('salesAlerts')}><span className="preference-icon"><Bell size={18}/></span><span><strong>Alertas de ventas</strong><small>Mantén activados los avisos relacionados con nuevas ventas y comisiones.</small></span><i className={prefs.salesAlerts?'on':''}><b/></i></button>
      <button type="button" className="preference-row" onClick={()=>toggle('trainingReminders')}><span className="preference-icon"><BookOpenCheck size={18}/></span><span><strong>Recordatorios de formación</strong><small>Recibe recordatorios visuales para continuar tu progreso en la Academia.</small></span><i className={prefs.trainingReminders?'on':''}><b/></i></button>
      <button type="button" className="preference-row" onClick={()=>toggle('interfaceSound')}><span className="preference-icon"><Volume2 size={18}/></span><span><strong>Sonidos de interfaz</strong><small>Activa o desactiva el feedback de sonido dentro de las lecciones.</small></span><i className={prefs.interfaceSound?'on':''}><b/></i></button>
    </section>
    <div className="preferences-footer"><span>{saved?<><CheckCircle2 size={15}/> Preferencias guardadas</>:<>Puedes cambiar estas opciones cuando quieras.</>}</span><button className="native-primary" onClick={save}><Save size={15}/> Guardar preferencias</button></div>
  </>;
}
