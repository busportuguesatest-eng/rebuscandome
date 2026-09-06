'use client';

import { FormEvent, useMemo, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, ImagePlus, Package, Plus, Save, UploadCloud, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Draft = {
  name: string; slug: string; category: string; shortDescription: string; description: string;
  audience: string; problem: string; transformation: string; benefits: string;
  price: string; currency: string; commission: string; promoPrice: string;
  landingUrl: string; landingHeadline: string; landingSubtitle: string;
  coverImage: string; gallery: string[]; videoUrl: string; promoNotes: string; status: 'draft'|'active'|'paused';
};

const initialDraft: Draft = {
  name:'', slug:'', category:'Educación digital', shortDescription:'', description:'', audience:'', problem:'', transformation:'', benefits:'',
  price:'19', currency:'USD', commission:'60', promoPrice:'', landingUrl:'', landingHeadline:'', landingSubtitle:'', coverImage:'', gallery:[], videoUrl:'', promoNotes:'', status:'active'
};

const steps = [
  ['Información', 'Qué vendemos'],
  ['Oferta + Landing', 'Precio y página'],
  ['Recursos', 'Lo que promociona el afiliado'],
  ['Revisión', 'Crear producto'],
];

const slugify = (value:string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

export default function NewProductPage(){
  const router = useRouter();
  const [draft,setDraft] = useState<Draft>(initialDraft);
  const [step,setStep] = useState(0);
  const [coverFile,setCoverFile] = useState<File|null>(null);
  const [galleryFiles,setGalleryFiles] = useState<File[]>([]);
  const [promoFiles,setPromoFiles] = useState<File[]>([]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');

  const affiliate = useMemo(()=>Number(draft.price||0)*Number(draft.commission||0)/100,[draft.price,draft.commission]);
  const platform = useMemo(()=>Number(draft.price||0)-affiliate,[draft.price,affiliate]);
  const completion = useMemo(()=>{
    const values=[draft.name,draft.slug,draft.shortDescription,draft.description,draft.price,draft.commission,draft.landingUrl,draft.landingHeadline,draft.audience,draft.problem,draft.transformation,draft.coverImage||coverFile?.name,draft.promoNotes||promoFiles.length];
    return Math.round(values.filter(Boolean).length/values.length*100);
  },[draft,coverFile,promoFiles]);

  const update=(key:keyof Draft,value:string|string[])=>setDraft(d=>({...d,[key]:value as never}));

  function onCover(files:FileList|null){ const f=files?.[0]||null; setCoverFile(f); if(f) setDraft(d=>({...d,coverImage:URL.createObjectURL(f)})); }
  function addGallery(files:FileList|null){ if(!files) return; const list=Array.from(files); setGalleryFiles(v=>[...v,...list]); setDraft(d=>({...d,gallery:[...d.gallery,...list.map(f=>f.name)]})); }
  function addPromo(files:FileList|null){ if(!files) return; setPromoFiles(v=>[...v,...Array.from(files)]); }

  async function createProduct(e:FormEvent){
    e.preventDefault(); setError(''); setBusy(true);
    try{
      if(!draft.name.trim()) throw new Error('Completa el nombre del producto.');
      if(!draft.shortDescription.trim()) throw new Error('Completa la descripción corta.');
      if(!draft.price || Number(draft.price)<=0) throw new Error('Indica un precio válido.');
      if(!draft.landingUrl.trim()) throw new Error('La URL de la Landing Page es obligatoria.');
      if(!coverFile && !draft.coverImage.trim()) throw new Error('Sube la portada principal o indica una URL.');
      if(promoFiles.length===0 && galleryFiles.length===0) throw new Error('Carga al menos un recurso para el afiliado.');

      const payload={name:draft.name.trim(),slug:draft.slug.trim()||slugify(draft.name),short_description:draft.shortDescription.trim(),description:draft.description.trim(),price:Number(draft.price),currency:draft.currency,default_commission:Number(draft.commission),landing_url:draft.landingUrl.trim(),cover_image:coverFile?null:draft.coverImage.trim()||null,status:draft.status,studio_data:{...draft,coverImage:undefined}};
      const createResponse=await fetch('/api/admin/products',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(payload)});
      const createText=await createResponse.text(); let createData:Record<string,unknown>={};
      try{createData=createText?JSON.parse(createText):{};}catch{throw new Error('El servidor devolvió una respuesta inválida al crear el producto.');}
      if(!createResponse.ok||createData.ok===false) throw new Error(String(createData.message||'No pudimos crear el producto.'));
      const productId=String((createData.product as Record<string,unknown>)?.id||''); if(!productId) throw new Error('El producto fue creado pero no recibimos su identificador.');

      const files:Array<{file:File;type:'cover'|'gallery'|'promotional';position:number}>=[];
      if(coverFile) files.push({file:coverFile,type:'cover',position:0});
      galleryFiles.forEach((file,i)=>files.push({file,type:'gallery',position:i}));
      promoFiles.forEach((file,i)=>files.push({file,type:'promotional',position:i}));
      if(files.length){
        const prep=await fetch('/api/admin/products/upload',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({action:'prepare',product_id:productId,files:files.map(({file})=>({name:file.name,type:file.type,size:file.size}))})});
        const prepText=await prep.text(); let prepData:Record<string,unknown>={}; try{prepData=prepText?JSON.parse(prepText):{};}catch{throw new Error('No pudimos preparar la subida de archivos.');}
        if(!prep.ok||prepData.ok===false) throw new Error(String(prepData.message||'No pudimos preparar la subida de archivos.'));
        const uploads=(prepData.uploads as Array<Record<string,unknown>>)||[]; if(uploads.length!==files.length) throw new Error('La preparación de archivos quedó incompleta.');
        const storage=createSupabaseBrowserClient();
        for(let i=0;i<files.length;i+=1){const target=uploads[i];const {error}=await storage.storage.from('product-assets').uploadToSignedUrl(String(target.path),String(target.token),files[i].file,{contentType:files[i].file.type||'application/octet-stream'});if(error)throw new Error(`No pudimos subir ${files[i].file.name}: ${error.message||'error de Storage'}`);}
        const complete=await fetch('/api/admin/products/upload',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({action:'complete',product_id:productId,assets:files.map(({file,type,position},i)=>({name:file.name,path:String(uploads[i].path),asset_type:type,size:file.size,mime_type:file.type||'application/octet-stream',position}))})});
        const completeText=await complete.text();let completeData:Record<string,unknown>={};try{completeData=completeText?JSON.parse(completeText):{};}catch{throw new Error('Los archivos se subieron, pero no pudimos registrarlos.');}
        if(!complete.ok||completeData.ok===false) throw new Error(String(completeData.message||'No pudimos registrar los archivos del producto.'));
      }
      router.push(`/admin/productos/${productId}?created=1`);
    }catch(err){setError(err instanceof Error?err.message:'No pudimos crear el producto.');}finally{setBusy(false);}
  }

  return <main className="native-page product-studio-page">
    <header className="native-topbar studio-header">
      <button className="ghost-link" onClick={()=>router.push('/admin/productos')}><ArrowLeft size={15}/> Productos</button>
      <div><span className="native-eyebrow">ADMINISTRACIÓN · PRODUCT STUDIO</span><h1>Crear producto</h1></div>
      <span className="native-badge"><Package size={14}/> {completion}% preparado</span>
    </header>

    <section className="studio-layout simple-studio-layout">
      <div className="studio-main">
        <div className="studio-progress simple-studio-progress">
          {steps.map(([title,subtitle],i)=><button key={title} type="button" className={`studio-step ${i===step?'active':''} ${i<step?'done':''}`} onClick={()=>setStep(i)}><span>{i<step?<Check size={14}/>:i+1}</span><strong>{title}</strong><small>{subtitle}</small></button>)}
        </div>

        <form className="studio-card" onSubmit={createProduct}>
          {step===0 && <>
            <div className="studio-section-head"><div><span className="native-eyebrow">01 · PRODUCTO</span><h2>Información esencial</h2><p>Solo lo necesario para presentar correctamente el producto a clientes y afiliados.</p></div><Package size={24}/></div>
            <div className="studio-form-grid">
              <label>Nombre del producto<input value={draft.name} onChange={e=>{update('name',e.target.value); if(!draft.slug) update('slug',slugify(e.target.value));}} placeholder="Ej. El Menú Inteligente"/></label>
              <label>Slug<input value={draft.slug} onChange={e=>update('slug',slugify(e.target.value))} placeholder="el-menu-inteligente"/></label>
              <label>Categoría<select value={draft.category} onChange={e=>update('category',e.target.value)}><option>Educación digital</option><option>Emprendimiento</option><option>Cocina</option><option>Marketing</option><option>Productividad</option><option>IA</option></select></label>
              <label>Descripción corta<input value={draft.shortDescription} onChange={e=>update('shortDescription',e.target.value)} placeholder="Qué obtiene el cliente en una frase."/></label>
              <label className="full">Descripción<textarea value={draft.description} onChange={e=>update('description',e.target.value)} rows={5} placeholder="Qué incluye y cómo ayuda al cliente."/></label>
              <label>Público objetivo<textarea value={draft.audience} onChange={e=>update('audience',e.target.value)} rows={4} placeholder="Quién lo necesita."/></label>
              <label>Problema que resuelve<textarea value={draft.problem} onChange={e=>update('problem',e.target.value)} rows={4} placeholder="Problema principal."/></label>
              <label>Transformación<textarea value={draft.transformation} onChange={e=>update('transformation',e.target.value)} rows={4} placeholder="Resultado esperado."/></label>
              <label>Beneficios principales<textarea value={draft.benefits} onChange={e=>update('benefits',e.target.value)} rows={4} placeholder="Un beneficio por línea."/></label>
            </div>
          </>}

          {step===1 && <>
            <div className="studio-section-head"><div><span className="native-eyebrow">02 · OFERTA + LANDING</span><h2>Precio y página de venta</h2><p>La landing será el destino comercial al que llegará el tráfico de los afiliados.</p></div><ExternalLink size={24}/></div>
            <div className="studio-form-grid">
              <label>Precio<input type="number" min="1" step="0.01" value={draft.price} onChange={e=>update('price',e.target.value)}/></label>
              <label>Comisión del afiliado %<input type="number" min="0" max="100" step="1" value={draft.commission} onChange={e=>update('commission',e.target.value)}/></label>
              <label>Moneda<select value={draft.currency} onChange={e=>update('currency',e.target.value)}><option value="USD">USD</option><option value="VES">VES</option></select></label>
              <label>Precio promocional<input value={draft.promoPrice} onChange={e=>update('promoPrice',e.target.value)} placeholder="Opcional"/></label>
              <label className="full">🔗 URL de Landing Page<input value={draft.landingUrl} onChange={e=>update('landingUrl',e.target.value)} placeholder="https://tudominio.com/el-menu-inteligente"/></label>
              <label>Headline<textarea value={draft.landingHeadline} onChange={e=>update('landingHeadline',e.target.value)} rows={3} placeholder="La promesa principal de la landing."/></label>
              <label>Subtítulo<textarea value={draft.landingSubtitle} onChange={e=>update('landingSubtitle',e.target.value)} rows={3} placeholder="Una explicación breve de la oferta."/></label>
              <label>Visibilidad<select value={draft.status} onChange={e=>update('status',e.target.value)}><option value="active">Activo · visible para afiliados</option><option value="draft">Borrador · solo administración</option><option value="paused">Pausado · oculto temporalmente</option></select><small style={{display:'block',marginTop:6,color:'#7a889a'}}>Para probar el circuito completo, déjalo en Activo.</small></label>
            </div>
            <div className="offer-breakdown"><div><span>Precio público</span><strong>{draft.currency} {Number(draft.price||0).toFixed(2)}</strong></div><div><span>Afiliado · {draft.commission}%</span><strong>{draft.currency} {affiliate.toFixed(2)}</strong></div><div><span>Rebuscándome · {100-Number(draft.commission||0)}%</span><strong>{draft.currency} {platform.toFixed(2)}</strong></div></div>
            <div className="studio-note"><ExternalLink size={16}/> <span>El enlace del afiliado hará tracking primero y después redirigirá a esta Landing Page.</span></div>
          </>}

          {step===2 && <>
            <div className="studio-section-head"><div><span className="native-eyebrow">03 · RECURSOS</span><h2>Recursos para el afiliado</h2><p>En esta etapa cargamos lo que el afiliado podrá usar para promocionar el producto. La formación de “cómo vender” estará en un módulo separado.</p></div><ImagePlus size={24}/></div>
            <label className="upload-zone"><input type="file" accept="image/*" onChange={e=>onCover(e.target.files)}/><UploadCloud size={28}/><strong>{coverFile?'Portada seleccionada':'Sube la portada principal'}</strong><span>PNG, JPG o WEBP.</span><em>{coverFile?.name||draft.coverImage||'Archivo obligatorio'}</em></label>
            <label>URL de portada (alternativa)<input value={draft.coverImage.startsWith('blob:')?'':draft.coverImage} onChange={e=>update('coverImage',e.target.value)} placeholder="https://..."/></label>
            <div className="studio-form-grid">
              <label>Galería de imágenes<input type="file" multiple accept="image/*" onChange={e=>addGallery(e.target.files)}/></label>
              <label>Video promocional<input value={draft.videoUrl} onChange={e=>update('videoUrl',e.target.value)} placeholder="https://..."/></label>
            </div>
            {draft.gallery.length>0 && <div className="file-list">{draft.gallery.map((name,i)=><div key={`${name}-${i}`}><ImagePlus size={14}/><span>{name}</span><button type="button" onClick={()=>setDraft(d=>({...d,gallery:d.gallery.filter((_,idx)=>idx!==i)}))}><X size={13}/></button></div>)}</div>}
            <label className="upload-zone compact"><input type="file" multiple accept="image/*,video/*,.pdf,.txt,.doc,.docx" onChange={e=>addPromo(e.target.files)}/><UploadCloud size={24}/><strong>Subir kit promocional</strong><span>Creatividades, videos, PDFs, guiones, copies y otros recursos.</span><em>{promoFiles.length?`${promoFiles.length} archivo(s) listos para subir`:'Al menos uno es obligatorio'}</em></label>
            <label>Notas para el afiliado<textarea value={draft.promoNotes} onChange={e=>update('promoNotes',e.target.value)} rows={4} placeholder="Cómo utilizar estos recursos, recomendaciones y contexto."/></label>
          </>}

          {step===3 && <>
            <div className="studio-section-head"><div><span className="native-eyebrow">04 · REVISIÓN</span><h2>Todo listo para crear</h2><p>Al finalizar, guardaremos la ficha del producto y los recursos en Supabase. La visibilidad elegida determinará si aparece de inmediato para los afiliados.</p></div><Check size={24}/></div>
            <div className="review-summary-grid">
              <div><span>Producto</span><strong>{draft.name||'Sin nombre'}</strong></div>
              <div><span>Precio</span><strong>{draft.currency} {Number(draft.price||0).toFixed(2)}</strong></div>
              <div><span>Comisión</span><strong>{Number(draft.commission||0).toFixed(0)}%</strong></div>
              <div><span>Landing</span><strong>{draft.landingUrl?'Lista':'Falta'}</strong></div>
              <div><span>Portada</span><strong>{coverFile||draft.coverImage?'Lista':'Falta'}</strong></div>
              <div><span>Recursos afiliado</span><strong>{promoFiles.length} archivo(s)</strong></div>
              <div><span>Visibilidad</span><strong>{draft.status==='active'?'Activo':draft.status==='paused'?'Pausado':'Borrador'}</strong></div>
            </div>
            <div className="publish-checklist simple-checklist">{['Información esencial','Precio y comisión','Landing Page','Portada','Recursos para afiliados','Notas de recursos'].map((item,i)=>{const ready=[draft.name&&draft.description,draft.price&&draft.commission,draft.landingUrl,coverFile||draft.coverImage,promoFiles.length>0,draft.promoNotes][i]; return <div key={item} className={ready?'ready':''}><span>{ready?<Check size={13}/>:i+1}</span>{item}</div>})}</div>
            <div className="studio-note"><Save size={16}/> <span><strong>Crear producto y finalizar</strong> guardará todo en Supabase y te devolverá al catálogo. No necesitas usar SQL para crear el producto.</span></div>
          </>}

          {error && <div className="native-error" style={{marginTop:16}}>{error}</div>}
          <div className="studio-footer-actions"><button type="button" className="native-secondary" onClick={()=>step===0?router.push('/admin/productos'):setStep(s=>s-1)}><ArrowLeft size={15}/> {step===0?'Cancelar':'Anterior'}</button><div className="studio-footer-right"><span>{step+1} de {steps.length}</span>{step<steps.length-1?<button type="button" className="native-primary" onClick={()=>setStep(s=>s+1)}>Continuar <Plus size={15}/></button>:<button className="native-primary" disabled={busy}><Save size={16}/>{busy?' Creando…':' Crear producto y finalizar'}</button>}</div></div>
        </form>
      </div>

      <aside className="studio-preview-column">
        <div className="studio-preview-card">
          <div className="studio-preview-top">
            <strong>Vista previa</strong>
            <span className="preview-live"><span/> En vivo</span>
          </div>
          <div className="preview-product-visual">
            {draft.coverImage && draft.coverImage.startsWith('blob:') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.coverImage} alt="Vista previa de portada" />
            ) : (
              <div><Package size={38}/><span>La portada aparecerá aquí</span></div>
            )}
          </div>
          <div className="preview-copy">
            <span className="preview-category">{draft.category || 'Categoría'}</span>
            <h3>{draft.name || 'Nombre del producto'}</h3>
            <p>{draft.shortDescription || 'La descripción corta del producto se mostrará aquí.'}</p>
            <div className="preview-price">
              <strong>{draft.currency} {Number(draft.promoPrice || draft.price || 0).toFixed(2)}</strong>
              <span>{draft.promoPrice ? `Precio regular ${draft.currency} ${Number(draft.price || 0).toFixed(2)}` : 'Precio del producto'}</span>
            </div>
            <div className="preview-link"><ExternalLink size={13}/><code>{draft.landingUrl || 'https://tudominio.com/tu-producto'}</code></div>
          </div>
          <div className="preview-actions">
            <button type="button" className="native-secondary" onClick={() => draft.landingUrl && window.open(draft.landingUrl, '_blank', 'noopener,noreferrer')} disabled={!draft.landingUrl}>
              <ExternalLink size={14}/> Probar landing
            </button>
            <button type="button" className="native-primary" onClick={() => setStep(3)}>
              <Check size={14}/> Revisar
            </button>
          </div>
        </div>

        <div className="studio-side-card">
          <div className="studio-side-head"><div><span className="native-eyebrow">PREPARACIÓN</span><h3 style={{margin:'4px 0 0',fontSize:'17px'}}>Producto listo para publicar</h3></div><strong>{completion}%</strong></div>
          <div className="completion-bar"><span style={{width:`${completion}%`}}/></div>
          <p>Completa información, oferta, landing y recursos para crear un producto sólido y listo para revisión.</p>
          <div className="standard-grid">
            <div><Check size={12}/> Información</div>
            <div><Check size={12}/> Oferta</div>
            <div><Check size={12}/> Landing</div>
            <div><Check size={12}/> Recursos</div>
          </div>
        </div>
      </aside>
    </section>
  </main>
}
