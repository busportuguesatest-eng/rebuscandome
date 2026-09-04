import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="auth-page">
      <section className="auth-card" role="status">
        <p className="eyebrow">404</p>
        <h1>Página no encontrada.</h1>
        <p>La dirección que intentaste abrir no existe o ya no está disponible.</p>
        <Link className="primary-btn" href="/">Volver al inicio</Link>
      </section>
    </main>
  );
}
