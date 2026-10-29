import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="standalone">
      <div className="brand">
        nexo<span>✳</span>
      </div>
      <h1>Este rincón todavía no existe.</h1>
      <p>El perfil o la publicación no está disponible.</p>
      <Link className="button primary" href="/">
        Volver al inicio
      </Link>
    </main>
  );
}
