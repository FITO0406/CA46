'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('CA46 global error:', error);
  }, [error]);

  return (
    <html lang="es">
      <body className="m-0 bg-[#080b0d] font-sans text-white">
        <div className="grid min-h-screen place-items-center px-5">
          <section className="w-full max-w-lg rounded-[2rem] border border-rose-400/20 bg-[#0c1013] p-8 text-center">
            <div className="text-4xl">⚠️</div>
            <h1 className="mt-4 text-3xl font-black">CA46 necesita recargar esta pantalla</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">No se ha borrado el proyecto. Se ha producido un error de interfaz y puedes volver a cargarlo.</p>
            <button type="button" onClick={reset} className="mt-6 rounded-xl bg-orange-500 px-6 py-3 font-black text-black">Volver a cargar CA46</button>
            {error.digest ? <p className="mt-5 font-mono text-[10px] text-slate-600">Referencia: {error.digest}</p> : null}
          </section>
        </div>
      </body>
    </html>
  );
}
