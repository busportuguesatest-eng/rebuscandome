'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { BookOpen, CircleDollarSign, Home, LogOut, Package, Settings, Users, ShoppingBag, X, Headphones } from 'lucide-react';
import { TopbarNotifications } from '@/components/topbar-notifications';

const affiliateNav = [
  ['/afiliado', 'Inicio', Home],
  ['/afiliado/productos', 'Productos', Package],
  ['/afiliado/centro-venta', 'Centro de Venta', ShoppingBag],
  ['/afiliado/academia', 'Academia', BookOpen],
  ['/afiliado/ingresos', 'Mis ingresos', CircleDollarSign],
  ['/afiliado/perfil', 'Mi perfil', Users],
  ['/afiliado/soporte', 'Soporte', Headphones],
] as const;

const adminNav = [
  ['/admin', 'Centro de mando', Home],
  ['/admin/afiliados', 'Afiliados', Users],
  ['/admin/productos', 'Productos', Package],
  ['/admin/finanzas', 'Ventas & Finanzas', CircleDollarSign],
  ['/admin/formacion', 'Formación & Recursos', BookOpen],
  ['/admin/configuracion', 'Configuración', Settings],
  ['/admin/soporte', 'Soporte', Headphones],
] as const;

export function PlatformShell({ role, name, children }: { role: 'affiliate' | 'admin'; name: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = role === 'admin' ? adminNav : affiliateNav;
  const [mobileOpen, setMobileOpen] = useState(false);

  async function logout() {
    setMobileOpen(false);
    await fetch('/auth/signout', { method: 'POST' });
    router.replace('/');
  }

  const initials = name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase() || (role === 'admin' ? 'AD' : 'AF');

  return (
    <div className={`platform-app ${mobileOpen ? 'mobile-nav-open' : ''}`}>
      {mobileOpen && <button className="platform-mobile-backdrop" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} />}
      <aside className="platform-sidebar" aria-label="Navegación principal">
        <button className="platform-mobile-close" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)}><X size={18} /></button>
        <div className="platform-brand">
          <div className="platform-brand-logo-wrap">
            <Image src="/brand/rebuscandome-logo.png" alt="Rebuscándome" width={190} height={63} priority className="platform-brand-logo" />
          </div>
          <div className="platform-brand-copy"><span>{role === 'admin' ? 'Centro de control' : 'Área de afiliado'}</span></div>
        </div>
        <nav className="platform-nav">
          {nav.map(([href, label, Icon]) => {
            const active = href === `/${role === 'affiliate' ? 'afiliado' : 'admin'}` ? pathname === href : pathname.startsWith(href);
            return <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={active ? 'active' : ''}><Icon size={17} /><span>{label}</span></Link>;
          })}
        </nav>
        <div className="platform-user-card">
          <Link href={role === 'affiliate' ? '/afiliado/perfil' : '/admin'} className="platform-user-identity">
            <div className="platform-avatar">{initials}</div>
            <div className="platform-user-meta"><strong>{name}</strong><small>{role === 'admin' ? 'Administrador único' : 'Afiliado activo'}</small></div>
          </Link>
          <button onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={15} /></button>
        </div>
      </aside>
      <main className="platform-main">
        <div className="platform-topbar">
          <button className="platform-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Abrir navegación">☰</button>
          <div className="platform-topbar-role">{role === 'admin' ? 'ÁREA ADMINISTRATIVA' : 'ÁREA AFILIADO'}</div>
          <div className="platform-topbar-actions"><span className="status-dot" /> Sesión activa <TopbarNotifications role={role} /></div>
        </div>
        <div className="platform-content">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="page-header"><div><span className="section-kicker">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</header>;
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-state-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function KpiCard({ label, value, helper, accent='blue' }: { label:string; value:string; helper:string; accent?: 'blue'|'yellow'|'green'|'red' }) {
  return <div className={`kpi-card ${accent}`}><span>{label}</span><strong>{value}</strong><small>{helper}</small></div>;
}
