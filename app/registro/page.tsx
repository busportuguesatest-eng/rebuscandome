'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, Check, ShieldCheck, Sparkles } from 'lucide-react';

export default function RegistroPage() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const passwordChecks = useMemo(() => ({
    length: password.length >= 8,
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  }), [password]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!accepted) return setMessage('Debes aceptar los términos y condiciones.');
    if (!Object.values(passwordChecks).every(Boolean)) return setMessage('Usa una contraseña de al menos 8 caracteres, con número y símbolo.');

    setLoading(true);
    try {
      const response = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        if (result.requiresConfirmation) {
          setSuccess(true);
          setMessage(result.message);
          window.setTimeout(() => {
            window.location.assign('/?registered=1');
          }, 650);
          return;
        }
        throw new Error(result.message || 'No fue posible crear la cuenta.');
      }

      setSuccess(true);
      setMessage(result.message || '¡Cuenta creada! Ya puedes iniciar sesión.');
      window.setTimeout(() => {
        window.location.assign(result.destination || '/?registered=1');
      }, 650);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible crear la cuenta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="signup-shell">
        <div className="signup-brand">
          <Link href="/" className="back-link"><ArrowLeft size={16} /> Volver al acceso</Link>
          <div className="signup-logo brand-logo-auth"><Image src="/brand/rebuscandome-isotipo.png" alt="Rebuscándome" width={58} height={58} /></div>
          <p className="eyebrow">REBUSCÁNDOME · AFILIADOS</p>
          <h1>Tu nueva vuelta para generar.</h1>
          <p>Regístrate una sola vez. Después te guiaremos para que conozcas la plataforma y prepares tu primera promoción.</p>
          <div className="signup-points">
            <span><Sparkles size={16} /> Academia y estrategias</span>
            <span><ShieldCheck size={16} /> Entorno seguro</span>
          </div>
        </div>

        <div className="signup-card">
          <div className="auth-header">
            <p className="eyebrow">PRIMER PASO</p>
            <h2>Crea tu cuenta</h2>
            <p>El registro público corresponde únicamente a afiliados.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>Nombre completo<input value={fullName} onChange={(e) => setFullName(e.target.value)} name="full_name" autoComplete="name" required placeholder="Ej. María González" /></label>
            <label>WhatsApp <span className="optional">Opcional</span><input value={phone} onChange={(e) => setPhone(e.target.value)} name="phone" inputMode="tel" autoComplete="tel" placeholder="0414 000 0000" /></label>
            <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} name="email" type="email" autoComplete="email" required placeholder="tu@email.com" /></label>
            <label>Contraseña<input value={password} onChange={(e) => setPassword(e.target.value)} name="password" type="password" autoComplete="new-password" minLength={8} required placeholder="Crea una contraseña segura" /></label>
            <div className="password-rules" aria-live="polite">
              <span className={passwordChecks.length ? 'ok' : ''}>{passwordChecks.length ? <Check size={14} /> : '•'} 8 caracteres</span>
              <span className={passwordChecks.number ? 'ok' : ''}>{passwordChecks.number ? <Check size={14} /> : '•'} Un número</span>
              <span className={passwordChecks.symbol ? 'ok' : ''}>{passwordChecks.symbol ? <Check size={14} /> : '•'} Un símbolo</span>
            </div>
            <label className="checkbox-row"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /> <span>Acepto los términos y condiciones y la política de privacidad.</span></label>
            <button className="primary-btn" disabled={loading}>{loading ? 'Creando cuenta…' : 'Crear mi cuenta'} {!loading && <ArrowRight size={18} />}</button>
          </form>

          {message && (
            <div className={success ? 'form-success register-success-card' : 'form-error'} role="status">
              {success ? (
                <>
                  <strong>Cuenta creada correctamente.</strong>
                  <span>{message}</span>
                  <Link href="/?registered=1" className="success-link">Ir al inicio de sesión <ArrowRight size={15} /></Link>
                </>
              ) : message}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
