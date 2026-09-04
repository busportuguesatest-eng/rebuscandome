'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export default function NewPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const { data: listener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, _session: Session | null) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });

    supabase.auth.getSession().then((result: { data: { session: Session | null } }) => {
      const { data } = result;
      if (data.session) setReady(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!ready) return setMessage('La sesión de recuperación no está disponible. Solicita un nuevo enlace.');
    if (password.length < 8 || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return setMessage('Usa una contraseña de al menos 8 caracteres, con número y símbolo.');
    }
    if (password !== confirm) return setMessage('Las contraseñas no coinciden.');

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setMessage('Tu contraseña fue actualizada. Ya puedes iniciar sesión nuevamente.');
      await supabase.auth.signOut();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible actualizar la contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" style={{ width: 'min(560px, 100%)' }}>
        <div className="auth-header">
          <p className="eyebrow">NUEVA CONTRASEÑA</p>
          <h2>Crea una contraseña nueva</h2>
          <p>{ready ? 'La sesión de recuperación está activa. Elige una contraseña segura.' : 'Validando el enlace de recuperación…'}</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>Nueva contraseña<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" placeholder="Crea una contraseña segura" required /></label>
          <label>Repite la contraseña<input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" autoComplete="new-password" placeholder="Repite tu contraseña" required /></label>
          <button className="primary-btn" disabled={loading || !ready || success}>{loading ? 'Guardando…' : 'Actualizar contraseña'} {!loading && !success && <ArrowRight size={18} />}</button>
        </form>
        {message && <div className={success ? 'form-success' : 'form-error'} role="status">{success && <CheckCircle2 size={16} />} {message}</div>}
        {success && <Link href="/" className="success-link">Volver al inicio de sesión <ArrowRight size={15} /></Link>}
      </section>
    </main>
  );
}
