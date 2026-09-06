'use client';

import { useState } from 'react';
import { Pause, Play, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProductStatusActions({ productId, status }: { productId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nextStatus = status === 'active' ? 'paused' : 'active';

  async function toggle() {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: productId, status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || 'No pudimos cambiar el estado.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cambiar el estado.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="product-status-action-row">
      <button className="native-secondary" type="button" onClick={toggle} disabled={busy}>
        {busy ? <RefreshCw size={13} className="spin"/> : status === 'active' ? <Pause size={13}/> : <Play size={13}/>}
        {busy ? 'Actualizando…' : status === 'active' ? 'Pausar' : 'Activar para afiliados'}
      </button>
      {error && <span className="native-error small">{error}</span>}
    </div>
  );
}
