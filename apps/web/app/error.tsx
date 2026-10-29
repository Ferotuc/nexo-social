'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <h1>Algo interrumpió la conexión.</h1>
      <p>Vuelve a intentarlo en un momento.</p>
      <button className="button primary" onClick={reset}>
        Intentar de nuevo
      </button>
    </main>
  );
}
