'use client';

import { FormEvent, useState } from 'react';
import { CheckCircle2, FileUp, Loader2, UploadCloud } from 'lucide-react';
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Product = { id: string; name: string };

export default function AdminResourceManager({ products }: { products: Product[] }) {
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('reel');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('published');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError(''); setMessage('');
    if (!productId || !title || !file) { setError('Completa producto, título y archivo.'); setSaving(false); return; }
    try {
      const prep = await fetch('/api/admin/products/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prepare', product_id: productId, files: [{ name: file.name, type: file.type, size: file.size }] }) });
      const prepText = await prep.text();
      let prepJson: Record<string, unknown> = {};
      try { prepJson = prepText ? JSON.parse(prepText) : {}; } catch { throw new Error('No pudimos preparar la subida.'); }
      if (!prep.ok || prepJson.ok === false) throw new Error(String(prepJson.message || 'No pudimos preparar la subida.'));
      const target = ((prepJson.uploads as Array<Record<string, unknown>>)?.[0]);
      if (!target) throw new Error('No recibimos la autorización de subida.');
      const { error: uploadError } = await createSupabaseBrowserClient().storage.from('product-assets').uploadToSignedUrl(String(target.path), String(target.token), file, { contentType: file.type || 'application/octet-stream' });
      if (uploadError) throw new Error(uploadError.message || 'No se pudo subir el archivo.');

      const r = await fetch('/api/admin/resources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, title, type, description, status, storagePath: String(target.path), fileName: file.name, mimeType: file.type || 'application/octet-stream', fileSize: file.size }) });
      const jsonText = await r.text();
      let json: Record<string, unknown> = {};
      try { json = jsonText ? JSON.parse(jsonText) : {}; } catch { throw new Error('El servidor devolvió una respuesta inválida.'); }
      if (!r.ok) throw new Error(String(json.error || 'No se pudo registrar el recurso.'));
      setMessage('Recurso guardado y asociado al producto correctamente.'); setTitle(''); setDescription(''); setFile(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar.'); }
    finally { setSaving(false); }
  }

  if (!products.length) return <div className="native-card"><strong>No hay productos disponibles.</strong><p>Crea primero un producto activo o en preparación para asociar recursos.</p></div>;

  return <form className="resource-manager-form" onSubmit={submit}>
    <div className="resource-manager-intro"><div className="resource-manager-icon"><UploadCloud size={20}/></div><div><span className="section-kicker">RECURSO DE PRODUCTO</span><h2>Publicar material para afiliados</h2><p>Carga una creatividad, guion, PDF o video y asígnalo a un producto. El afiliado lo verá dentro de su Centro de Venta cuando esté publicado.</p></div></div>
    <div className="resource-manager-grid">
      <label><span>Producto</span><select value={productId} onChange={e=>setProductId(e.target.value)}>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label><span>Tipo</span><select value={type} onChange={e=>setType(e.target.value)}><option value="reel">Reel</option><option value="story">Story</option><option value="post">Post</option><option value="carousel">Carrusel</option><option value="video">Video</option><option value="script">Guion</option><option value="copy">Copy</option><option value="prompt">Prompt</option><option value="pdf">PDF</option><option value="other">Otro</option></select></label>
      <label className="resource-manager-full"><span>Título</span><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ej. Reel — 3 errores al organizar tus comidas"/></label>
      <label className="resource-manager-full"><span>Descripción</span><textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Indica al afiliado para qué sirve y cómo utilizar este recurso." rows={4}/></label>
      <label className="resource-manager-full"><span>Archivo</span><div className="resource-dropzone"><FileUp size={20}/><strong>{file ? file.name : 'Selecciona o arrastra un archivo'}</strong><small>Máximo 50 MB</small><input type="file" onChange={e=>setFile(e.target.files?.[0] || null)}/></div></label>
      <label><span>Visibilidad</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="published">Publicado · visible al afiliado</option><option value="draft">Borrador · solo administración</option></select></label>
    </div>
    {error && <div className="native-error">{error}</div>}
    {message && <div className="native-success"><CheckCircle2 size={16}/>{message}</div>}
    <div className="resource-manager-footer"><span>El archivo se almacena en Supabase Storage y queda vinculado al producto.</span><button className="native-primary" disabled={saving}>{saving?<><Loader2 size={15} className="spin"/> Guardando…</>:<><UploadCloud size={15}/> Publicar recurso</>}</button></div>
  </form>;
}
