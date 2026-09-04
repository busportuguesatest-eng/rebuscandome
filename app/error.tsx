'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[rebuscandome-ui-error]', error);
  }, [error]);

  return (
    <main className="auth-page">
      <section className="auth-card" role="alert" aria-live="assertive">
        <p className="eyebrow">REBUSCÁNDOME</p>
        <h1>Algo no salió como esperábamos.</h1>
        <p>La plataforma encontró un error inesperado. Puedes intentar cargar esta sección nuevamente.</p>
        <button className="primary-btn" type="button" onClick={() => reset()}>Intentar de nuevo</button>
      </section>
    </main>
  );
}
