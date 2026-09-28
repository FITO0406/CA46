'use client';

import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('CA46 page error:', error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-[#080b0d] px-5 text-white">
      <section className="w-full max-w-lg rounded-[2rem] border border-rose-400/20 bg-[#0c1013] p-8 text-center shadow-2xl">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-rose-500/10 text-3xl">⚠️</div>
        <p className="mt-6 text-xs font-black uppercase tracking-[.22em] text-rose-300">CA46 · Recuperación</p>
        <h1 className="mt-2 text-3xl font-black">Esta sección no ha cargado bien</h1>
        <p className="mt-4 text-sm leading-6 text-slate-400">La aplicación sigue activa. Puedes reintentar esta pantalla sin perder el resto del proyecto.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={reset} className="rounded-xl bg-orange-500 px-5 py-3 font-black text-black">Reintentar</button>
          <a href="/mi-empresa" className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-black text-slate-300">Ir a Mi empresa</a>
        </div>
        {error.digest ? <p className="mt-5 font-mono text-[10px] text-slate-600">Referencia: {error.digest}</p> : null}
      </section>
    </div>
  );
}
