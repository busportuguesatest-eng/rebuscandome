'use client';

import { Bell, CheckCheck, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type NotificationItem = { id: string; type: string; title: string; message: string; read_at: string | null; created_at: string };

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return new Date(value).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
}

export function TopbarNotifications({ role }: { role: 'affiliate' | 'admin' }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/notifications?limit=12', { cache: 'no-store', credentials: 'include' });
      const body = await r.json().catch(() => ({}));
      if (r.ok && body.ok) setItems(body.notifications ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const unread = items.filter(x => !x.read_at).length;

  async function markRead(id?: string) {
    try {
      await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(id ? { id } : { all: true }) });
      setItems(prev => prev.map(x => id ? (x.id === id ? { ...x, read_at: new Date().toISOString() } : x) : ({ ...x, read_at: new Date().toISOString() })));
    } catch { /* visual state remains usable */ }
  }

  return <div className="topbar-notifications" ref={ref}>
    <button className={`topbar-notification-trigger ${open ? 'active' : ''}`} type="button" title="Notificaciones" aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ''}`} onClick={() => { setOpen(v => !v); if (!open) void load(); }}>
      <Bell size={17} />
      {unread > 0 && <span className="notification-count">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <div className="topbar-notification-panel" role="dialog" aria-label="Notificaciones">
      <div className="topbar-notification-head"><div><span className="section-kicker">CENTRO DE AVISOS</span><h3>Notificaciones</h3></div><div className="topbar-notification-head-actions"><button type="button" onClick={() => void markRead()} disabled={!unread} title="Marcar todo como leído"><CheckCheck size={15}/></button><button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={15}/></button></div></div>
      {loading ? <div className="notification-state"><Loader2 size={17} className="spin"/> Cargando…</div> : !items.length ? <div className="notification-state">No tienes notificaciones nuevas.</div> : <div className="notification-list">{items.map(item => <button key={item.id} type="button" className={`notification-item ${item.read_at ? 'read' : 'unread'}`} onClick={() => void markRead(item.id)}><span className="notification-dot"/><span className="notification-item-copy"><strong>{item.title}</strong><small>{item.message}</small><time>{relativeTime(item.created_at)}</time></span></button>)}</div>}
      <a className="notification-footer-link" href={role === 'admin' ? '/admin/notificaciones' : '/afiliado/notificaciones'}>Ver centro de notificaciones</a>
    </div>}
  </div>;
}
