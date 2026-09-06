'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import Image from 'next/image';

export default function HomePage() {
  const [role, setRole] = useState<'affiliate' | 'admin'>('affiliate');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRegistered(params.get('registered') === '1');
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const lower = error.message.toLowerCase();
        if (lower.includes('email not confirmed')) throw new Error('Debes confirmar tu correo antes de iniciar sesión.');
        if (lower.includes('invalid login credentials')) throw new Error('El correo o la contraseña no son correctos.');
        throw new Error(error.message);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No fue posible validar tu sesión.');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role,status')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error('Tu perfil todavía no está disponible.');
      }

      if (profile.status !== 'active') {
        await supabase.auth.signOut();
        throw new Error('Tu cuenta no está activa.');
      }

      if (profile.role !== role) {
        await supabase.auth.signOut();
        throw new Error(role === 'admin'
          ? 'Esta cuenta no tiene permisos de administrador.'
          : 'Esta cuenta pertenece al entorno administrativo.');
      }

      // El onboarding ya no interviene en el login.
      // El afiliado entra siempre al dashboard y, si es su primer acceso,
      // el dashboard muestra el onboarding como ventana flotante.
      window.location.assign(profile.role === 'admin' ? '/admin' : '/afiliado');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible iniciar sesión.');
      setLoading(false);
    }
  }

  function continueToLogin() {
    setRegistered(false);
    window.history.replaceState({}, '', '/');
  }

  return (
    <main className="onboarding-shell">
      <section className="brand-panel">
        <div className="brand-mark brand-logo-auth"><Image src="/brand/rebuscandome-isotipo.png" alt="Rebuscándome" width={58} height={58} priority /></div>
        <p className="eyebrow">REBUSCÁNDOME</p>
        <h1>Aprende. Promociona. <span>Genera.</span></h1>
        <p className="lead">Una plataforma creada para ayudarte a convertir productos digitales en oportunidades reales de ingreso.</p>
        <div className="trust-row">
          <span><Sparkles size={16} /> Formación</span>
          <span><BriefcaseBusiness size={16} /> Herramientas</span>
          <span><ShieldCheck size={16} /> Control</span>
        </div>
      </section>

      {registered && (
        <div className="success-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="registered-title">
          <div className="success-modal">
            <button type="button" className="modal-close" aria-label="Cerrar" onClick={continueToLogin}>×</button>
            <div className="success-modal-icon"><CheckCircle2 size={26} /></div>
            <p className="eyebrow">CUENTA CREADA</p>
            <h2 id="registered-title">Ya puedes iniciar sesión</h2>
            <p>Tu cuenta de afiliado fue creada correctamente. Entra con tus datos y accederás directamente a tu dashboard; en tu primer acceso te mostraremos una bienvenida guiada.</p>
            <button type="button" className="primary-btn" onClick={continueToLogin}>Continuar al inicio de sesión <ArrowRight size={18} /></button>
          </div>
        </div>
      )}

      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-header">
          <p className="eyebrow">ACCESO A LA PLATAFORMA</p>
          <h2 id="login-title">Bienvenido de nuevo</h2>
          <p>Accede al entorno que corresponde a tu cuenta.</p>
        </div>

        <div className="role-switch" role="tablist" aria-label="Tipo de acceso">
          <button type="button" className={role === 'affiliate' ? 'active' : ''} onClick={() => { setRole('affiliate'); setMessage(''); }} role="tab" aria-selected={role === 'affiliate'}>
            <span className="role-icon"><BriefcaseBusiness size={18} /></span>
            Soy afiliado
            <small>Promociono productos y genero comisiones</small>
          </button>
          <button type="button" className={role === 'admin' ? 'active' : ''} onClick={() => { setRole('admin'); setMessage(''); }} role="tab" aria-selected={role === 'admin'}>
            <span className="role-icon"><ShieldCheck size={18} /></span>
            Soy administrador
            <small>Gestiono la plataforma y sus métricas</small>
          </button>
        </div>

        <form className="auth-form" onSubmit={handleLogin}>
          <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="tu@email.com" required /></label>
          <label>Contraseña<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" placeholder="••••••••" required /></label>
          <button className="primary-btn" disabled={loading}>{loading ? 'Validando…' : 'Iniciar sesión'} {!loading && <ArrowRight size={18} />}</button>
        </form>

        {message && <div className="form-error" role="alert">{message}</div>}
        <p className="register-hint"><a href="/recuperar">¿Olvidaste tu contraseña?</a></p>
        {role === 'affiliate' && <p className="register-hint">¿Es tu primera vez? <a href="/registro">Crea tu cuenta de afiliado</a></p>}
        {role === 'admin' && <p className="admin-note"><CheckCircle2 size={15} /> El acceso administrativo es privado; Rebuscándome tiene un único administrador.</p>}
      </section>
    </main>
  );
}
