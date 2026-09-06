'use client';

import { useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

export default function AffiliateAvatarEditor({ initialUrl, name }: { initialUrl?: string | null; name: string }) {
  const [url, setUrl] = useState(initialUrl || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const initials = name.split(/\s+/).map((x) => x[0]).join('').slice(0,2).toUpperCase() || 'AF';
  async function upload(file: File) {
    setError('');
    if (!file.type.startsWith('image/')) return setError('Selecciona una imagen válida.');
    if (file.size > 5 * 1024 * 1024) return setError('La foto no puede superar 5 MB.');
    setBusy(true);
    try {
      const prep = await fetch('/api/affiliate/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: file.name, type: file.type, size: file.size }) });
      const body = await prep.json().catch(() => ({}));
      if (!prep.ok || !body.ok) throw new Error(body.error || 'No se pudo preparar la foto.');
      const storage = createClient();
      const { error: uploadError } = await storage.storage.from('avatars').uploadToSignedUrl(body.path, body.token, file, { contentType: file.type });
      if (uploadError) throw new Error(uploadError.message || 'No se pudo subir la foto.');
      const save = await fetch('/api/affiliate/avatar', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: body.path }) });
      const saveBody = await save.json().catch(() => ({}));
      if (!save.ok || !saveBody.ok) throw new Error(saveBody.error || 'No se pudo guardar la foto.');
      const nextUrl = `${body.path}?v=${Date.now()}`;
      setUrl(nextUrl);
      window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo actualizar la foto.'); }
    finally { setBusy(false); }
  }
  return <div className="profile-avatar-editor">
    <div className="profile-avatar-preview">{url ? <img src={url} alt={`Foto de ${name}`} /> : <span>{initials}</span>}</div>
    <div><span className="section-kicker">FOTO DE PERFIL</span><h3>Haz tu perfil más personal</h3><p>Sube una imagen JPG, PNG o WEBP de hasta 5 MB.</p><label className="profile-avatar-upload"><Camera size={14}/>{busy ? <><Loader2 size={14} className="spin"/> Subiendo…</> : <>Cambiar foto<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e)=>{ const file=e.target.files?.[0]; if(file) void upload(file); }} /></>}</label>{error && <small className="form-error">{error}</small>}</div>
  </div>;
}
