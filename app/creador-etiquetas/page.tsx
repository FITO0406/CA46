'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';

type ExtraField = { label: string; value: string };
type SelectedPhoto = { id: string; file: File; url: string };
type PhotoState = { state: 'pending' | 'analyzing' | 'done' | 'error'; message?: string };

type LabelDraft = {
  description: string;
  scientific_name: string;
  lote: string;
  marca: string;
  kg_neto: string;
  metodo: string;
  presentacion: string;
  procedencia: string;
  fao: string;
  frescura: string;
  arte: string;
  ce: string;
  subzona: string;
  primer_expedidor: string;
  poblacion: string;
  fecha_captura: string;
  comprador: string;
  nif: string;
  extra_fields: ExtraField[];
  confidence: number;
  needs_review: boolean;
  review_fields: string[];
};

type InvoiceResult = {
  photoId: string;
  fileName: string;
  invoice_number: string;
  invoice_date: string;
  expedidor: string;
  cif_expedidor: string;
  registro_sanitario_expedidor: string;
  buyer: string;
  buyer_nif: string;
  invoice_extra_fields: ExtraField[];
  warnings: string[];
  labels: LabelDraft[];
};

type LabelStringKey = Exclude<keyof LabelDraft, 'extra_fields' | 'confidence' | 'needs_review' | 'review_fields'>;
type InvoiceStringKey = Exclude<keyof InvoiceResult, 'photoId' | 'fileName' | 'invoice_extra_fields' | 'warnings' | 'labels'>;

const LABEL_FIELDS: Array<{ key: LabelStringKey; label: string; wide?: boolean; important?: boolean }> = [
  { key: 'description', label: 'Especie', wide: true },
  { key: 'scientific_name', label: 'Nombre científico', wide: true },
  { key: 'lote', label: 'Lote · IMPORTANTE', wide: true, important: true },
  { key: 'procedencia', label: 'Procedencia', wide: true },
  { key: 'subzona', label: 'Subzona' },
  { key: 'primer_expedidor', label: 'Primer expedidor', wide: true },
  { key: 'poblacion', label: 'Población' },
  { key: 'fecha_captura', label: 'Fecha de captura' },
  { key: 'fao', label: 'FAO' },
  { key: 'frescura', label: 'Frescura' },
  { key: 'metodo', label: 'Método de producción', wide: true },
  { key: 'arte', label: 'Arte de pesca', wide: true },
  { key: 'kg_neto', label: 'Peso neto (kg)' },
  { key: 'marca', label: 'Marca' },
  { key: 'presentacion', label: 'Presentación' },
  { key: 'ce', label: 'CE / registro partida' },
  { key: 'comprador', label: 'Comprador', wide: true },
  { key: 'nif', label: 'NIF comprador' },
];

const INVOICE_FIELDS: Array<{ key: InvoiceStringKey; label: string; wide?: boolean }> = [
  { key: 'invoice_number', label: 'Número de factura' },
  { key: 'invoice_date', label: 'Fecha de factura' },
  { key: 'expedidor', label: 'Expedidor', wide: true },
  { key: 'cif_expedidor', label: 'CIF expedidor' },
  { key: 'registro_sanitario_expedidor', label: 'Registro sanitario expedidor', wide: true },
  { key: 'buyer', label: 'Comprador', wide: true },
  { key: 'buyer_nif', label: 'CIF/NIF comprador' },
];

function CameraIcon() {
  return <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h3l1.5-2h7L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/></svg>;
}

function GalleryIcon() {
  return <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>;
}

async function compressForUpload(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 2200;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.84));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

function normalizeInvoice(photo: SelectedPhoto, analysis: any): InvoiceResult {
  return {
    photoId: photo.id,
    fileName: photo.file.name,
    invoice_number: analysis?.invoice_number || '',
    invoice_date: analysis?.invoice_date || '',
    expedidor: analysis?.expedidor || '',
    cif_expedidor: analysis?.cif_expedidor || '',
    registro_sanitario_expedidor: analysis?.registro_sanitario_expedidor || '',
    buyer: analysis?.buyer || '',
    buyer_nif: analysis?.buyer_nif || '',
    invoice_extra_fields: Array.isArray(analysis?.invoice_extra_fields) ? analysis.invoice_extra_fields : [],
    warnings: Array.isArray(analysis?.warnings) ? analysis.warnings : [],
    labels: Array.isArray(analysis?.labels) ? analysis.labels.map((label: any) => ({
      ...label,
      description: label?.description || '',
      scientific_name: label?.scientific_name || '',
      lote: label?.lote || '',
      marca: label?.marca || '',
      kg_neto: label?.kg_neto || '',
      metodo: label?.metodo || '',
      presentacion: label?.presentacion || '',
      procedencia: label?.procedencia || '',
      fao: label?.fao || '',
      frescura: label?.frescura || '',
      arte: label?.arte || '',
      ce: label?.ce || '',
      subzona: label?.subzona || '',
      primer_expedidor: label?.primer_expedidor || '',
      poblacion: label?.poblacion || '',
      fecha_captura: label?.fecha_captura || '',
      comprador: label?.comprador || '',
      nif: label?.nif || '',
      confidence: Number(label?.confidence || 0),
      needs_review: Boolean(label?.needs_review),
      extra_fields: Array.isArray(label?.extra_fields) ? label.extra_fields : [],
      review_fields: Array.isArray(label?.review_fields) ? label.review_fields : [],
    })) : [],
  };
}

export default function CreadorEtiquetasPage() {
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const captureSection = useRef<HTMLElement>(null);

  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [photoStates, setPhotoStates] = useState<Record<string, PhotoState>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<InvoiceResult[]>([]);
  const [analysisErrors, setAnalysisErrors] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishedCount, setPublishedCount] = useState<number | null>(null);
  const [publishedExpiresAt, setPublishedExpiresAt] = useState('');

  const totalSize = useMemo(() => photos.reduce((sum, photo) => sum + photo.file.size, 0), [photos]);
  const totalLabels = useMemo(() => results.reduce((sum, invoice) => sum + invoice.labels.length, 0), [results]);
  const completedPhotos = useMemo(() => Object.values(photoStates).filter((item) => item.state === 'done' || item.state === 'error').length, [photoStates]);
  const allReviewed = useMemo(() => {
    if (totalLabels === 0 || analyzing) return false;
    return results.every((invoice) => invoice.labels.every((label) =>
      Boolean(label.description?.trim()) && Boolean(label.lote?.trim()) && Boolean(label.procedencia?.trim()) &&
      !label.needs_review && (label.review_fields || []).length === 0
    ));
  }, [results, totalLabels, analyzing]);

  function resetAnalysis() {
    setResults([]);
    setAnalysisErrors([]);
    setPhotoStates({});
    setProgress({ current: 0, total: 0 });
    setPublishError('');
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const incoming = Array.from(fileList).filter((file) => file.type.startsWith('image/')).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      url: URL.createObjectURL(file),
    }));
    if (incoming.length === 0) return;
    setPublishedCount(null);
    resetAnalysis();
    setPhotos((current) => [...current, ...incoming]);
  }

  function removePhoto(id: string) {
    resetAnalysis();
    setPhotos((current) => {
      const photo = current.find((item) => item.id === id);
      if (photo) URL.revokeObjectURL(photo.url);
      return current.filter((item) => item.id !== id);
    });
  }

  function clearAll() {
    photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    setPhotos([]);
    resetAnalysis();
  }

  async function analyzePhotos() {
    if (photos.length === 0 || analyzing) return;

    setAnalyzing(true);
    setResults([]);
    setAnalysisErrors([]);
    setPublishError('');
    setProgress({ current: 0, total: photos.length });
    setPhotoStates(Object.fromEntries(photos.map((photo) => [photo.id, { state: 'pending' as const }])));

    const nextResults: InvoiceResult[] = [];
    const nextErrors: string[] = [];

    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      setProgress({ current: index + 1, total: photos.length });
      setPhotoStates((current) => ({ ...current, [photo.id]: { state: 'analyzing' } }));

      try {
        const optimized = await compressForUpload(photo.file);
        const formData = new FormData();
        formData.append('image', optimized);
        const response = await fetch('/api/analyze-invoice', { method: 'POST', body: formData });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || 'No se pudo leer la factura.');

        const invoice = normalizeInvoice(photo, payload?.analysis || {});
        nextResults.push(invoice);

        // Importante para lotes: cada factura aparece en pantalla en cuanto termina,
        // sin esperar a que se analicen todas las fotos seleccionadas.
        setResults([...nextResults]);
        setPhotoStates((current) => ({
          ...current,
          [photo.id]: {
            state: 'done',
            message: `${invoice.labels.length} ${invoice.labels.length === 1 ? 'etiqueta generada' : 'etiquetas generadas'}`,
          },
        }));
      } catch (error: any) {
        const message = `Factura ${index + 1}: ${error?.message || 'error de lectura'}`;
        nextErrors.push(message);
        setAnalysisErrors([...nextErrors]);
        setPhotoStates((current) => ({ ...current, [photo.id]: { state: 'error', message } }));
      }
    }

    setProgress({ current: photos.length, total: photos.length });
    setAnalyzing(false);
  }

  function updateLabelField(invoiceIndex: number, labelIndex: number, field: LabelStringKey, value: string) {
    setResults((current) => current.map((invoice, currentInvoiceIndex) => {
      if (currentInvoiceIndex !== invoiceIndex) return invoice;
      return {
        ...invoice,
        labels: invoice.labels.map((label, currentLabelIndex) => {
          if (currentLabelIndex !== labelIndex) return label;
          const nextReviewFields = value.trim() ? label.review_fields.filter((reviewField) => reviewField !== field) : label.review_fields;
          return { ...label, [field]: value, review_fields: nextReviewFields, needs_review: nextReviewFields.length > 0 };
        }),
      };
    }));
  }

  function updateInvoiceField(invoiceIndex: number, field: InvoiceStringKey, value: string) {
    setResults((current) => current.map((invoice, index) => index === invoiceIndex ? { ...invoice, [field]: value } : invoice));
  }

  function confirmLabelReview(invoiceIndex: number, labelIndex: number) {
    setResults((current) => current.map((invoice, currentInvoiceIndex) => {
      if (currentInvoiceIndex !== invoiceIndex) return invoice;
      return {
        ...invoice,
        labels: invoice.labels.map((label, currentLabelIndex) => {
          if (currentLabelIndex !== labelIndex) return label;
          const criticalOk = label.description.trim() && label.lote.trim() && label.procedencia.trim();
          return criticalOk ? { ...label, needs_review: false, review_fields: [] } : label;
        }),
      };
    }));
  }

  async function publishLabels() {
    if (!allReviewed || publishing) return;
    setPublishing(true);
    setPublishError('');
    try {
      const response = await fetch('/api/publish-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoices: results }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'No se pudieron publicar las etiquetas.');

      photos.forEach((photo) => URL.revokeObjectURL(photo.url));
      setPublishedCount(payload?.published || totalLabels);
      setPublishedExpiresAt(payload?.expires_at || '');
      setPhotos([]);
      setResults([]);
      setAnalysisErrors([]);
      setPhotoStates({});
      setProgress({ current: 0, total: 0 });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      setPublishError(error?.message || 'Error al publicar las etiquetas.');
    } finally {
      setPublishing(false);
    }
  }

  function startAnother() {
    setPublishedCount(null);
    setPublishedExpiresAt('');
    setPublishError('');
    captureSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#080b0d] text-white selection:bg-orange-500/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_5%,rgba(249,115,22,.16),transparent_26%),radial-gradient(circle_at_86%_18%,rgba(148,163,184,.08),transparent_24%)]" />

      <header className="relative border-b border-white/10 bg-[#0c1013]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-4">
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-orange-400/20 bg-black shadow-lg shadow-orange-950/40"><Image src="/ca46-logo.svg" alt="CA46" fill priority sizes="56px" className="object-cover" /></div>
            <div><p className="text-xl font-black tracking-tight">CA46</p><p className="text-xs font-semibold text-slate-500">Creador de etiquetas</p></div>
          </Link>
          <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">← Inicio</Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        {publishedCount !== null ? (
          <section className="mx-auto mb-10 max-w-4xl rounded-[2rem] border border-emerald-400/25 bg-emerald-400/[.07] p-7 text-center sm:p-10">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-3xl">✓</div>
            <p className="mt-5 text-xs font-black uppercase tracking-[.22em] text-emerald-300">Publicación completada</p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl">{publishedCount} {publishedCount === 1 ? 'etiqueta publicada' : 'etiquetas publicadas'} correctamente</h1>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">Ya están visibles en la pantalla de clientes y permanecerán activas durante 72 horas.</p>
            {publishedExpiresAt ? <p className="mt-2 text-xs font-bold text-slate-600">Vigentes hasta {new Date(publishedExpiresAt).toLocaleString('es-ES')}</p> : null}
            <div className="mt-7 grid gap-3 sm:grid-cols-2"><button type="button" onClick={startAnother} className="rounded-2xl bg-orange-500 px-6 py-4 text-lg font-black text-[#111416]">📷 Analizar otra factura</button><Link href="/etiquetas" className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-lg font-black text-white">🖥️ Ver etiquetas publicadas</Link></div>
          </section>
        ) : null}

        <section className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-orange-400/20 bg-orange-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.22em] text-orange-300">Captura · lectura · revisión · publicación</span>
          <h1 className="mt-5 text-balance text-4xl font-black tracking-[-.045em] sm:text-6xl">De una factura a todas sus <span className="block bg-gradient-to-r from-orange-400 via-amber-300 to-slate-200 bg-clip-text text-transparent">etiquetas de trazabilidad</span></h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">Selecciona una o varias fotos. En lotes grandes, CA46 te va enseñando las etiquetas según termina cada factura.</p>
        </section>

        <section ref={captureSection} className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-2">
          <button type="button" onClick={() => cameraInput.current?.click()} disabled={analyzing || publishing} className="rounded-[2rem] border border-orange-400/25 bg-gradient-to-br from-orange-500/[.16] via-white/[.055] to-white/[.025] p-7 text-left shadow-2xl shadow-orange-950/20 disabled:opacity-50 sm:p-8"><div className="grid h-16 w-16 place-items-center rounded-2xl border border-orange-400/25 bg-orange-500/10 text-orange-300"><CameraIcon /></div><p className="mt-7 text-xs font-black uppercase tracking-[.22em] text-orange-400">Desde el móvil</p><h2 className="mt-2 text-3xl font-black">Hacer foto</h2><p className="mt-3 leading-7 text-slate-400">Fotografía el documento completo con buena luz y lo más recto posible.</p></button>
          <button type="button" onClick={() => galleryInput.current?.click()} disabled={analyzing || publishing} className="rounded-[2rem] border border-white/10 bg-white/[.045] p-7 text-left shadow-2xl shadow-black/20 disabled:opacity-50 sm:p-8"><div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-200"><GalleryIcon /></div><p className="mt-7 text-xs font-black uppercase tracking-[.22em] text-slate-500">Selección múltiple</p><h2 className="mt-2 text-3xl font-black">Elegir fotos</h2><p className="mt-3 leading-7 text-slate-400">Selecciona todas las facturas que quieras procesar del tirón desde la galería.</p></button>
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = ''; }} />
          <input ref={galleryInput} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = ''; }} />
        </section>

        <section className="mx-auto mt-8 max-w-5xl rounded-[2rem] border border-white/10 bg-white/[.035] p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
            <div><p className="text-xs font-black uppercase tracking-[.22em] text-orange-400">Paso 1 · Fotografías</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">{photos.length === 0 ? 'Aún no has añadido ninguna factura' : `${photos.length} ${photos.length === 1 ? 'fotografía seleccionada' : 'fotografías seleccionadas'}`}</h2>{photos.length > 0 ? <p className="mt-2 text-sm font-semibold text-slate-500">{(totalSize / 1024 / 1024).toFixed(1)} MB originales · selección múltiple activa</p> : null}</div>
            {photos.length > 0 && !analyzing && !publishing ? <button type="button" onClick={clearAll} className="rounded-full border border-white/10 px-4 py-2 text-sm font-black text-slate-400">Quitar todas</button> : null}
          </div>

          {photos.length > 0 ? <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{photos.map((photo, index) => {
            const status = photoStates[photo.id];
            return <article key={photo.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/30"><div className="relative aspect-[4/3] bg-black"><img src={photo.url} alt={`Factura ${index + 1}`} className="h-full w-full object-cover" /><span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-black text-white">Factura {index + 1}</span></div><div className="p-4"><div className="flex items-center justify-between gap-3"><p className="min-w-0 truncate text-sm font-bold text-slate-300">{photo.file.name}</p>{!analyzing && !publishing ? <button type="button" onClick={() => removePhoto(photo.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-slate-500">×</button> : null}</div>{status ? <p className={`mt-2 text-xs font-black ${status.state === 'done' ? 'text-emerald-300' : status.state === 'error' ? 'text-rose-300' : status.state === 'analyzing' ? 'text-orange-300' : 'text-slate-500'}`}>{status.state === 'pending' ? 'En cola' : status.state === 'analyzing' ? 'Analizando…' : status.message}</p> : null}</div></article>;
          })}</div> : <div className="py-12 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-orange-500/10 text-2xl">📷</div><p className="mt-4 font-bold text-slate-400">Añade una o varias facturas para empezar</p></div>}

          <button type="button" onClick={analyzePhotos} disabled={photos.length === 0 || analyzing || publishing} className="mt-6 w-full rounded-2xl bg-orange-500 px-6 py-4 text-lg font-black text-[#111416] disabled:bg-slate-800 disabled:text-slate-600">{analyzing ? `Procesando ${completedPhotos} de ${photos.length} · ahora factura ${progress.current}` : `Analizar y separar etiquetas (${photos.length})`}</button>
          {analyzing ? <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${photos.length ? (completedPhotos / photos.length) * 100 : 0}%` }} /></div> : null}
          {analysisErrors.length > 0 ? <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/[.07] p-4"><p className="font-black text-rose-200">Algunas fotos no se pudieron leer; las demás sí se conservan</p>{analysisErrors.map((error) => <p key={error} className="mt-2 text-sm text-rose-100/70">• {error}</p>)}</div> : null}
        </section>

        {results.length > 0 ? <section className="mx-auto mt-8 max-w-6xl">
          <div className="rounded-[2rem] border border-orange-400/20 bg-orange-500/[.06] p-6 sm:p-8"><p className="text-xs font-black uppercase tracking-[.22em] text-orange-400">Paso 2 · Etiquetas generadas</p><h2 className="mt-2 text-3xl font-black sm:text-4xl">{totalLabels} {totalLabels === 1 ? 'etiqueta disponible' : 'etiquetas disponibles'} para revisar</h2><p className="mt-3 text-slate-400">Si has subido varias fotos, cada factura aparece aquí en cuanto termina su lectura. No hace falta esperar a todo el lote.</p></div>

          <div className="mt-6 space-y-7">{results.map((invoice, invoiceIndex) => <article key={invoice.photoId} className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.035]">
            <header className="border-b border-white/10 bg-black/20 p-5 sm:p-6"><p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">{invoice.fileName}</p><h3 className="mt-2 text-2xl font-black">Datos generales de la factura</h3><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{INVOICE_FIELDS.map((field) => <label key={field.key} className={field.wide ? 'sm:col-span-2' : ''}><span className="mb-2 block text-[11px] font-black uppercase tracking-[.16em] text-slate-500">{field.label}</span><input value={invoice[field.key]} onChange={(event) => updateInvoiceField(invoiceIndex, field.key, event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none focus:border-orange-400" placeholder="No figura" /></label>)}</div>{invoice.invoice_extra_fields.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{invoice.invoice_extra_fields.map((field) => <span key={`${field.label}-${field.value}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300"><strong>{field.label}:</strong> {field.value}</span>)}</div> : null}{invoice.warnings.length > 0 ? <div className="mt-4 rounded-xl border border-amber-400/15 bg-amber-400/[.06] p-3 text-sm text-amber-100/70">{invoice.warnings.join(' · ')}</div> : null}</header>

            <div className="space-y-5 p-5 sm:p-6">{invoice.labels.length === 0 ? <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[.06] p-5 text-amber-100/80">No se ha podido separar ninguna partida de esta fotografía.</div> : invoice.labels.map((label, labelIndex) => <div key={`${invoice.photoId}-${labelIndex}`} className={`rounded-2xl border p-5 ${label.needs_review ? 'border-amber-400/25 bg-amber-400/[.035]' : 'border-white/10 bg-black/20'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-slate-500">Etiqueta {labelIndex + 1}</p><h4 className="mt-1 text-2xl font-black">{label.description || 'Producto por revisar'}</h4></div><div className="flex gap-2"><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-400">Confianza {Math.round((label.confidence || 0) * 100)}%</span>{label.needs_review ? <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-300">⚠ Revisar</span> : <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">✓ Revisada</span>}</div></div>

              {/descongelad/i.test(label.frescura || '') ? <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm font-black uppercase tracking-wide text-amber-200">DESCONGELADO · Consumir preferentemente en 3 días</div> : null}

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{LABEL_FIELDS.map((field) => { const flagged = label.review_fields.includes(field.key); const value = label[field.key] || ''; return <label key={field.key} className={field.wide ? 'sm:col-span-2' : ''}><span className={`mb-2 block text-[11px] font-black uppercase tracking-[.16em] ${field.important ? 'text-orange-300' : flagged ? 'text-amber-300' : 'text-slate-500'}`}>{field.label}{flagged ? ' · revisar' : ''}</span><input value={value} onChange={(event) => updateLabelField(invoiceIndex, labelIndex, field.key, event.target.value)} className={`w-full rounded-xl border bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none focus:border-orange-400 ${field.important ? 'border-orange-400/35' : flagged ? 'border-amber-400/35' : 'border-white/10'}`} placeholder="No figura" /></label>; })}</div>

              {label.extra_fields.length > 0 ? <div className="mt-5"><p className="mb-2 text-[11px] font-black uppercase tracking-[.16em] text-slate-500">Otros datos detectados</p><div className="flex flex-wrap gap-2">{label.extra_fields.map((field) => <span key={`${field.label}-${field.value}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300"><strong>{field.label}:</strong> {field.value}</span>)}</div></div> : null}

              {label.needs_review ? <button type="button" onClick={() => confirmLabelReview(invoiceIndex, labelIndex)} disabled={!label.description.trim() || !label.lote.trim() || !label.procedencia.trim()} className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm font-black text-amber-200 disabled:opacity-30">✓ Confirmar que he revisado esta etiqueta</button> : null}
            </div>)}</div>
          </article>)}</div>

          <div className="mt-7 rounded-[2rem] border border-white/10 bg-white/[.035] p-6 sm:flex sm:items-center sm:justify-between sm:gap-6"><div><p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">Paso 3</p><h3 className="mt-2 text-2xl font-black">Publicar durante 72 horas</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Las etiquetas generadas correctamente se conservan aunque otra foto del lote dé error.</p>{analyzing ? <p className="mt-3 text-sm font-bold text-orange-300">Espera a que termine el lote antes de publicar.</p> : !allReviewed ? <p className="mt-3 text-sm font-bold text-amber-300">Revisa y confirma todas las etiquetas antes de publicar.</p> : null}{publishError ? <p className="mt-3 text-sm font-bold text-rose-300">{publishError}</p> : null}</div><button type="button" onClick={publishLabels} disabled={!allReviewed || publishing || analyzing} className="mt-5 w-full rounded-2xl bg-orange-500 px-6 py-4 font-black text-[#111416] disabled:bg-slate-800 disabled:text-slate-600 sm:mt-0 sm:w-auto">{publishing ? 'Publicando…' : `Publicar ${totalLabels} ${totalLabels === 1 ? 'etiqueta' : 'etiquetas'}`}</button></div>
        </section> : null}
      </main>
    </div>
  );
}
