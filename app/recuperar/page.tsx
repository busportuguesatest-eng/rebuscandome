'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

export default function RecoverPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      const supabase = createClient();
      const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
      const siteUrl = configuredSiteUrl || window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${siteUrl}/auth/confirm?next=/recuperar/nueva`,
      });
      if (error) throw error;
      setSuccess(true);
      setMessage('Revisa tu correo. Te enviamos un enlace para crear una nueva contraseña.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible enviar el correo de recuperación.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" style={{ width: 'min(560px, 100%)' }}>
        <Link href="/" className="back-link" style={{ color: 'var(--text)' }}><ArrowLeft size={16} /> Volver al acceso</Link>
        <div className="auth-header" style={{ marginTop: 28 }}>
          <p className="eyebrow">RECUPERACIÓN SEGURA</p>
          <h2>Restablece tu contraseña</h2>
          <p>Te enviaremos un enlace temporal al correo asociado a tu cuenta.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="tu@email.com" required /></label>
          <button className="primary-btn" disabled={loading || success}>{loading ? 'Enviando…' : 'Enviar enlace'} {!loading && !success && <ArrowRight size={18} />}</button>
        </form>
        {message && <div className={success ? 'form-success' : 'form-error'} role="status"><ShieldCheck size={16} /> {message}</div>}
      </section>
    </main>
  );
}
