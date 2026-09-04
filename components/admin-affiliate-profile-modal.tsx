'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CircleDollarSign, Link2, LoaderCircle, MousePointerClick, ShoppingBag, WalletCards, X } from 'lucide-react';

export function AdminAffiliateProfileModal({ affiliateId }: { affiliateId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<any>(null);

  async function openProfile() {
    setOpen(true);
    if (detail) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/affiliates/${affiliateId}`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || 'No pudimos cargar el perfil.');
      setDetail(body.detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cargar el perfil.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  return <>
    <button className="ghost-link" type="button" onClick={openProfile}>Ver perfil <ArrowRight size={13} /></button>
    {open && <div className="affiliate-profile-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.currentTarget === e.target) setOpen(false); }}>
      <section className="affiliate-profile-modal" role="dialog" aria-modal="true" aria-labelledby="affiliate-profile-title">
        <div className="affiliate-profile-modal-head">
          <div>
            <span className="section-kicker">PERFIL DEL AFILIADO</span>
            <h2 id="affiliate-profile-title">{detail?.affiliate?.profiles?.full_name || 'Perfil del afiliado'}</h2>
            {detail?.affiliate?.affiliate_code && <p>Código {detail.affiliate.affiliate_code} · {detail.affiliate.status}</p>}
          </div>
          <button className="icon-action" type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={17} /></button>
        </div>
        {loading ? <div className="affiliate-profile-loading"><LoaderCircle size={20} className="spin" /> Cargando información…</div> : error ? <div className="form-error">{error}</div> : detail ? <>
          <div className="performance-kpi-grid">
            <div><MousePointerClick size={17}/><span>Clicks</span><strong>{detail.totals.totalClicks}</strong><small>Tracking atribuido</small></div>
            <div><ShoppingBag size={17}/><span>Ventas</span><strong>{detail.totals.sales}</strong><small>{detail.totals.conversion.toFixed(2)}% conversión</small></div>
            <div><CircleDollarSign size={17}/><span>Facturación</span><strong>${detail.totals.totalRevenue.toFixed(2)}</strong><small>Ventas confirmadas</small></div>
            <div><CircleDollarSign size={17}/><span>Comisión</span><strong>${detail.totals.totalCommission.toFixed(2)}</strong><small>${detail.totals.available.toFixed(2)} disponible</small></div>
          </div>
          <div className="affiliate-profile-modal-grid">
            <section className="modal-data-card"><span className="section-kicker">DATOS</span><div><b>Nombre</b><span>{detail.affiliate.profiles?.full_name || 'Sin nombre'}</span></div><div><b>Teléfono</b><span>{detail.affiliate.profiles?.phone || 'No registrado'}</span></div><div><b>País</b><span>{detail.affiliate.profiles?.country || 'VE'}</span></div><div><b>Comisión base</b><span>{Number(detail.affiliate.default_commission || 0).toFixed(0)}%</span></div></section>
            <section className="modal-data-card"><span className="section-kicker">ACTIVIDAD</span><div><b>Enlaces</b><span>{detail.links.length}</span></div><div><b>Ventas</b><span>{detail.sales.length}</span></div><div><b>Retiros</b><span>{detail.payouts.length}</span></div><div><b>Formación</b><span>{detail.progress.filter((x: any) => x.completed).length} lecciones</span></div></section>
          </div>
          <section className="modal-table-card"><div className="panel-heading"><div><span className="section-kicker">ÚLTIMAS VENTAS</span><h3>Actividad comercial</h3></div><ShoppingBag size={17}/></div>{detail.sales.length ? <div className="table-scroll"><table><thead><tr><th>Producto</th><th>Monto</th><th>Comisión</th><th>Estado</th></tr></thead><tbody>{detail.sales.slice(0,8).map((sale: any) => <tr key={sale.id}><td>{sale.products?.name || 'Producto'}</td><td>${Number(sale.gross_amount || 0).toFixed(2)}</td><td>${Number(sale.commission_amount || 0).toFixed(2)}</td><td><span className={`status-pill ${sale.status}`}>{sale.status}</span></td></tr>)}</tbody></table></div> : <p className="modal-empty">Todavía no hay ventas.</p>}</section>
          <div className="affiliate-profile-modal-foot"><span><WalletCards size={14}/> {detail.payouts.length} retiros registrados</span><span><Link2 size={14}/> {detail.links.length} enlaces activos/registrados</span></div>
        </> : null}
      </section>
    </div>}
  </>;
}
