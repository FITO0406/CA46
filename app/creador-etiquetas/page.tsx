'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';

type SelectedPhoto = {
  id: string;
  file: File;
  url: string;
};

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h3l1.5-2h7L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

export default function CreadorEtiquetasPage() {
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);

  const totalSize = useMemo(
    () => photos.reduce((sum, photo) => sum + photo.file.size, 0),
    [photos]
  );

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;

    const incoming = Array.from(fileList)
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        url: URL.createObjectURL(file),
      }));

    setPhotos((current) => [...current, ...incoming]);
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const photo = current.find((item) => item.id === id);
      if (photo) URL.revokeObjectURL(photo.url);
      return current.filter((item) => item.id !== id);
    });
  }

  function clearAll() {
    photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    setPhotos([]);
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#080b0d] text-white selection:bg-orange-500/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_5%,rgba(249,115,22,.16),transparent_26%),radial-gradient(circle_at_86%_18%,rgba(148,163,184,.08),transparent_24%)]" />

      <header className="relative border-b border-white/10 bg-[#0c1013]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-4">
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-orange-400/20 bg-black shadow-lg shadow-orange-950/40">
              <Image src="/ca46-logo.svg" alt="CA46" fill priority sizes="56px" className="object-cover" />
            </div>
            <div>
              <p className="text-xl font-black tracking-tight">CA46</p>
              <p className="text-xs font-semibold text-slate-500">Creador de etiquetas</p>
            </div>
          </Link>

          <Link
            href="/"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300 transition hover:border-orange-400/40 hover:bg-orange-500/10 hover:text-orange-300"
          >
            ← Inicio
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        <section className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-orange-400/20 bg-orange-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.22em] text-orange-300">
            Paso 1 · Captura de factura
          </span>
          <h1 className="mt-5 text-balance text-4xl font-black tracking-[-.045em] sm:text-6xl">
            Convierte tus facturas en
            <span className="block bg-gradient-to-r from-orange-400 via-amber-300 to-slate-200 bg-clip-text text-transparent">etiquetas de trazabilidad</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
            Haz una foto directamente o selecciona varias imágenes de la galería. CA46 procesará cada factura y separará cada partida en su propia etiqueta.
          </p>
        </section>

        <section className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-2">
          <button
            type="button"
            onClick={() => cameraInput.current?.click()}
            className="group rounded-[2rem] border border-orange-400/25 bg-gradient-to-br from-orange-500/[.16] via-white/[.055] to-white/[.025] p-7 text-left shadow-2xl shadow-orange-950/20 transition hover:border-orange-300/60 hover:bg-orange-500/[.12] sm:p-8"
          >
            <div className="grid h-16 w-16 place-items-center rounded-2xl border border-orange-400/25 bg-orange-500/10 text-orange-300">
              <CameraIcon />
            </div>
            <p className="mt-7 text-xs font-black uppercase tracking-[.22em] text-orange-400">Desde el móvil</p>
            <h2 className="mt-2 text-3xl font-black">Hacer foto</h2>
            <p className="mt-3 max-w-md leading-7 text-slate-400">Abre la cámara y fotografía la factura completa con buena luz y el papel lo más recto posible.</p>
          </button>

          <button
            type="button"
            onClick={() => galleryInput.current?.click()}
            className="group rounded-[2rem] border border-white/10 bg-white/[.045] p-7 text-left shadow-2xl shadow-black/20 transition hover:border-orange-400/35 hover:bg-white/[.065] sm:p-8"
          >
            <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-200">
              <GalleryIcon />
            </div>
            <p className="mt-7 text-xs font-black uppercase tracking-[.22em] text-slate-500">Una o varias</p>
            <h2 className="mt-2 text-3xl font-black">Elegir fotos</h2>
            <p className="mt-3 max-w-md leading-7 text-slate-400">Selecciona varias fotografías de golpe si las has hecho antes o te las ha enviado un compañero.</p>
          </button>

          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              addFiles(event.target.files);
              event.currentTarget.value = '';
            }}
          />
          <input
            ref={galleryInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              addFiles(event.target.files);
              event.currentTarget.value = '';
            }}
          />
        </section>

        <section className="mx-auto mt-8 max-w-5xl rounded-[2rem] border border-white/10 bg-white/[.035] p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[.22em] text-orange-400">Fotos preparadas</p>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                {photos.length === 0 ? 'Aún no has añadido ninguna factura' : `${photos.length} ${photos.length === 1 ? 'fotografía' : 'fotografías'} seleccionadas`}
              </h2>
              {photos.length > 0 ? (
                <p className="mt-2 text-sm font-semibold text-slate-500">{(totalSize / 1024 / 1024).toFixed(1)} MB en total</p>
              ) : null}
            </div>
            {photos.length > 0 ? (
              <button type="button" onClick={clearAll} className="rounded-full border border-white/10 px-4 py-2 text-sm font-black text-slate-400 transition hover:border-rose-400/30 hover:text-rose-300">
                Quitar todas
              </button>
            ) : null}
          </div>

          {photos.length > 0 ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((photo, index) => (
                <article key={photo.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                  <div className="relative aspect-[4/3] bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={`Factura ${index + 1}`} className="h-full w-full object-cover" />
                    <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-black text-white backdrop-blur">Factura {index + 1}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 p-4">
                    <p className="min-w-0 truncate text-sm font-bold text-slate-300">{photo.file.name}</p>
                    <button type="button" onClick={() => removePhoto(photo.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-slate-500 transition hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-300" aria-label="Eliminar foto">
                      ×
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-orange-500/10 text-2xl">📷</div>
              <p className="mt-4 font-bold text-slate-400">Añade una factura para empezar</p>
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-amber-400/15 bg-amber-400/[.06] p-4 text-sm leading-6 text-amber-100/80">
            <strong className="text-amber-200">Siguiente fase:</strong> lectura OCR propia de CA46, detección de todas las partidas, revisión de campos y publicación de todas las etiquetas. Esta pantalla de captura ya queda preparada para ese flujo.
          </div>

          <button
            type="button"
            disabled={photos.length === 0}
            className="mt-5 w-full rounded-2xl bg-orange-500 px-6 py-4 text-lg font-black text-[#111416] shadow-lg shadow-orange-950/30 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none"
          >
            Continuar al análisis ({photos.length})
          </button>
        </section>
      </main>
    </div>
  );
}
