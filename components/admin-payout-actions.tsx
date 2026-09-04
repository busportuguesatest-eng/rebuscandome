'use client';

import { useState } from 'react';

export function AdminPayoutActions({ id, status }: { id: string; status: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const payable = ['requested', 'review', 'approved', 'processing'].includes(status);

  async function call(path: string, success: string) {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(path, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Operación no completada.');
      setMessage(success);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Operación no completada.');
    } finally {
      setBusy(false);
    }
  }

  if (status === 'paid') return <span className="status-pill paid">Pagado</span>;
  if (!payable) return <span className="status-pill">{status}</span>;

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button className="native-primary" disabled={busy} onClick={() => call(`/api/admin/payouts/${id}/pay`, 'Retiro pagado.')}>{busy ? 'Procesando…' : 'Marcar pagado'}</button>
      {message && <span className="native-muted">{message}</span>}
    </div>
  );
}
