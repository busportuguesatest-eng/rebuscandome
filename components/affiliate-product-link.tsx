'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, ExternalLink, Link2, Loader2, Sparkles } from 'lucide-react';
import { AffiliateProductPerformance } from '@/components/affiliate-product-performance';

type LinkRow = { id: string; code: string; product_id: string; affiliate_id: string; status: string };

export function AffiliateProductLink({ existing, productId, productSlug }: { existing: LinkRow | null; productId: string; productSlug: string }) {
  const [link, setLink] = useState<LinkRow | null>(existing);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setLink(existing), [existing]);

  function publicUrl(code: string) {
    return `${window.location.origin}/go/${encodeURIComponent(code)}`;
  }

  async function create() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/affiliate/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'No se pudo generar el enlace.');
      setLink(payload as LinkRow);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el enlace.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(publicUrl(link.code));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('No se pudo copiar el enlace.');
    }
  }

  if (!link) {
    return (
      <div className="affiliate-link-panel compact">
        <div className="affiliate-link-head">
          <div className="affiliate-link-icon"><Link2 size={18}/></div>
          <div>
            <span className="section-kicker">TU ENLACE DE AFILIADO</span>
            <h3>Listo para promocionar</h3>
            <p>Genera tu enlace único. Los clicks y futuras ventas quedarán atribuidos a tu cuenta.</p>
          </div>
        </div>
        {error && <div className="native-error small">{error}</div>}
        <button className="native-primary affiliate-link-cta" onClick={create} disabled={busy}>
          {busy ? <><Loader2 size={15} className="spin"/> Generando…</> : <><Sparkles size={15}/> Generar mi enlace</>}
        </button>
      </div>
    );
  }

  const url = publicUrl(link.code);
  return (
    <div className="affiliate-link-panel">
      <div className="affiliate-link-head">
        <div className="affiliate-link-icon success"><Link2 size={18}/></div>
        <div>
          <span className="section-kicker">TU ENLACE DE AFILIADO</span>
          <h3>Ya tienes un enlace activo</h3>
          <p>Comparte este enlace en tus canales. Primero registra el click y luego envía al visitante a la landing.</p>
        </div>
        <span className="status active">Activo</span>
      </div>
      <div className="affiliate-link-url"><code>{url}</code><button className="icon-action" onClick={copy} title="Copiar enlace" aria-label="Copiar enlace">{copied ? <Check size={15}/> : <Copy size={15}/>}</button></div>
      {error && <div className="native-error small">{error}</div>}
      <div className="affiliate-link-actions">
        <button className="native-primary" onClick={copy}>{copied ? <><Check size={15}/> Copiado</> : <><Copy size={15}/> Copiar enlace</>}</button>
        <a className="native-secondary" href={url} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Probar enlace</a>
        <AffiliateProductPerformance productId={productId} productName={productSlug} />
      </div>
    </div>
  );
}
