'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Merca = {
  id: string;
  name: string;
  location: string;
  portalName?: string;
  portalUrl?: string;
};

const STORAGE_KEY = 'ca46:mi-merca';

const MERCAS: Merca[] = [
  { id: 'mercalgeciras', name: 'Mercalgeciras', location: 'Algeciras · Cádiz' },
  { id: 'mercalicante', name: 'Mercalicante', location: 'Alicante' },
  { id: 'mercasturias', name: 'Mercasturias', location: 'Llanera · Asturias' },
  { id: 'mercabadajoz', name: 'Mercabadajoz', location: 'Badajoz' },
  { id: 'mercabarna', name: 'Mercabarna', location: 'Barcelona' },
  {
    id: 'mercabilbao',
    name: 'Mercabilbao',
    location: 'Basauri · Bizkaia',
    portalName: 'TicketOnline · Servicios profesionales',
    portalUrl: 'https://www.mercabilbao.eus/ticketonline/',
  },
  { id: 'mercacordoba', name: 'Mercacórdoba', location: 'Córdoba' },
  { id: 'mercagalicia', name: 'Mercagalicia', location: 'Santiago de Compostela' },
  { id: 'mercagranada', name: 'Mercagranada', location: 'Granada' },
  { id: 'mercairuna', name: 'Mercairuña', location: 'Pamplona' },
  { id: 'mercajerez', name: 'Mercajerez', location: 'Jerez de la Frontera · Cádiz' },
  {
    id: 'mercalaspalmas',
    name: 'Mercalaspalmas',
    location: 'Gran Canaria',
    portalName: 'Portal del Cliente',
    portalUrl: 'https://mercalaspalmas.odoo.com/web/login',
  },
  { id: 'mercaleon', name: 'Mercaleón', location: 'León' },
  {
    id: 'mercamadrid',
    name: 'Mercamadrid',
    location: 'Madrid',
    portalName: 'Área de Clientes',
    portalUrl: 'https://areaprivada.mercamadrid.es/auth/login?returnUrl=%2Fdashboard',
  },
  { id: 'mercamalaga', name: 'Mercamálaga', location: 'Málaga' },
  { id: 'mercamurcia', name: 'Mercamurcia', location: 'El Palmar · Murcia' },
  { id: 'mercaolid', name: 'Mercaolid', location: 'Valladolid' },
  { id: 'mercapalma', name: 'Mercapalma', location: 'Palma de Mallorca' },
  { id: 'mercasalamanca', name: 'Mercasalamanca', location: 'Salamanca' },
  { id: 'mercasantander', name: 'Mercasantander', location: 'Santander' },
  {
    id: 'mercasevilla',
    name: 'Mercasevilla',
    location: 'Sevilla',
    portalName: 'GESICO Sistemas · Compradores',
    portalUrl: 'https://sevilla.gesicosistemas.es/login',
  },
  { id: 'mercatenerife', name: 'Mercatenerife', location: 'Santa Cruz de Tenerife' },
  { id: 'mercavalencia', name: 'Mercavalencia', location: 'Valencia' },
  { id: 'mercazaragoza', name: 'Mercazaragoza', location: 'Zaragoza' },
];

export default function MiMercaPage() {
  const [selectedId, setSelectedId] = useState('mercasevilla');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && MERCAS.some((merca) => merca.id === stored)) setSelectedId(stored);
  }, []);

  const selected = useMemo(
    () => MERCAS.find((merca) => merca.id === selectedId) || MERCAS.find((merca) => merca.id === 'mercasevilla')!,
    [selectedId],
  );

  function selectMerca(id: string) {
    setSelectedId(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  }

  return (
    <div className="min-h-screen bg-[#0a0d0f] text-white selection:bg-orange-500/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(249,115,22,.16),transparent_28%),radial-gradient(circle_at_85%_30%,rgba(14,165,233,.10),transparent_25%)]" />

      <header className="relative border-b border-white/10 bg-[#0d1114]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div>
            <p className="text-xl font-black tracking-tight">CA46</p>
            <p className="text-xs font-medium text-slate-400">Ecosistema de trazabilidad</p>
          </div>
          <Link
            href="/etiquetas"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:border-orange-400/50 hover:bg-orange-500/10"
          >
            ← Volver a etiquetas
          </Link>
        </div>
      </header>

      <main className="relative mx-auto flex min-h-[calc(100vh-89px)] max-w-6xl items-center justify-center px-5 py-12 sm:px-8">
        <section className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.055] shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="border-b border-white/10 px-6 py-6 sm:px-8">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-orange-500/15 text-2xl shadow-inner shadow-orange-500/10">
                🏢
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[.22em] text-orange-400">Acceso externo</p>
                <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">MI MERCA</h1>
              </div>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-8 sm:py-10">
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[.15em] text-slate-500">Selecciona tu Merca habitual</span>
              <select
                value={selected.id}
                onChange={(event) => selectMerca(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#11161a] px-4 py-4 text-base font-black text-white outline-none transition focus:border-orange-400"
              >
                {MERCAS.map((merca) => (
                  <option key={merca.id} value={merca.id}>
                    {merca.name} · {merca.location}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs font-black uppercase tracking-[.18em] text-slate-500">Tu mercado</p>
              <h2 className="mt-2 text-2xl font-black">{selected.name}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-400">{selected.location}</p>
            </div>

            {selected.portalUrl ? (
              <>
                <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.07] p-4">
                  <div className="flex gap-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
                    <div>
                      <p className="font-bold text-emerald-200">{selected.portalName}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        Acceso profesional verificado. CA46 no guarda ni procesa tus credenciales; el inicio de sesión se realiza directamente en la plataforma externa.
                      </p>
                    </div>
                  </div>
                </div>

                <a
                  href={selected.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-7 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-orange-500 px-6 py-4 text-center text-lg font-black text-[#111416] shadow-lg shadow-orange-950/30 transition hover:bg-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-[#0a0d0f]"
                >
                  Acceder a {selected.portalName}
                  <span aria-hidden="true" className="text-2xl">↗</span>
                </a>
              </>
            ) : (
              <div className="mt-5 rounded-2xl border border-amber-400/15 bg-amber-400/[.06] p-4">
                <p className="font-bold text-amber-200">Sin portal profesional verificado</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Todavía no tenemos localizado un acceso profesional oficial para este Merca. No mostraremos enlaces no verificados.
                </p>
              </div>
            )}

            <p className="mt-5 text-center text-xs font-semibold leading-5 text-slate-500">
              MI MERCA es solo un acceso directo. Las credenciales se introducen siempre en la plataforma oficial del Merca o de su proveedor.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
