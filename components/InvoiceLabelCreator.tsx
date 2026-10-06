'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { tenantAuthorizationHeader } from '@/lib/tenant-company-config';
import { useCreatorDraft } from '@/lib/use-creator-draft';
import { analyzeSavedPhoto, discardAnalysisJobs } from '@/lib/label-analysis-client';

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
  buyer_number: string;
  invoice_extra_fields: ExtraField[];
  warnings: string[];
  labels: LabelDraft[];
};

type InvoiceWork = {
  photos: Array<Omit<SelectedPhoto, 'url'>>;
  photoStates: Record<string, PhotoState>;
  results: InvoiceResult[];
  analysisErrors: string[];
  analyzing: boolean;
  publishedCount: number | null;
  publishedExpiresAt: string;
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

const CRITICAL_REVIEW_FIELDS = new Set(['description', 'lote', 'procedencia']);
const inputClass = 'w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-orange-400';

function labelReadyToPublish(label: LabelDraft) {
  const criticalReviewPending = (label.review_fields || []).some((field) => CRITICAL_REVIEW_FIELDS.has(field));
  return Boolean(label.description?.trim()) && Boolean(label.lote?.trim()) && Boolean(label.procedencia?.trim()) && !criticalReviewPending;
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
    const baseName = file.name?.replace(/\.[^.]+$/, '') || `foto-${Date.now()}`;
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
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
    buyer_number: analysis?.buyer_number || '',
    invoice_extra_fields: Array.isArray(analysis?.invoice_extra_fields) ? analysis.invoice_extra_fields : [],
    warnings: Array.isArray(analysis?.warnings) ? analysis.warnings : [],
    labels: Array.isArray(analysis?.labels) ? analysis.labels.map((label: any) => ({
      description: label?.description || '', scientific_name: label?.scientific_name || '', lote: label?.lote || '',
      marca: label?.marca || '', kg_neto: label?.kg_neto || '', metodo: label?.metodo || '', presentacion: label?.presentacion || '',
      procedencia: label?.procedencia || '', fao: label?.fao || '', frescura: label?.frescura || '', arte: label?.arte || '', ce: label?.ce || '',
      subzona: label?.subzona || '', primer_expedidor: label?.primer_expedidor || '', poblacion: label?.poblacion || '', fecha_captura: label?.fecha_captura || '',
      comprador: label?.comprador || '', nif: label?.nif || '', confidence: Number(label?.confidence || 0), needs_review: Boolean(label?.needs_review),
      extra_fields: Array.isArray(label?.extra_fields) ? label.extra_fields : [], review_fields: Array.isArray(label?.review_fields) ? label.review_fields : [],
    })) : [],
  };
}

export default function InvoiceLabelCreator({ employeeMode = false }: { employeeMode?: boolean }) {
  const invoiceRoute = employeeMode ? '/empleado/etiquetas' : '/creador-etiquetas';
  const boxRoute = employeeMode ? '/empleado/etiqueta-caja' : '/creador-etiquetas/etiqueta-temporal';
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [photoStates, setPhotoStates] = useState<Record<string, PhotoState>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<InvoiceResult[]>([]);
  const [analysisErrors, setAnalysisErrors] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishedCount, setPublishedCount] = useState<number | null>(null);
  const [publishedExpiresAt, setPublishedExpiresAt] = useState('');
  const [captureMessage, setCaptureMessage] = useState('');
  const [resumeRequested, setResumeRequested] = useState(false);
  const snapshot = useMemo<InvoiceWork>(() => ({
    photos: photos.map(({ id, file }) => ({ id, file })), photoStates, results, analysisErrors,
    analyzing, publishedCount, publishedExpiresAt,
  }), [photos, photoStates, results, analysisErrors, analyzing, publishedCount, publishedExpiresAt]);
  const draft = useCreatorDraft('invoice', snapshot, (saved) => {
    setPhotos(saved.photos.map((photo) => ({ ...photo, url: URL.createObjectURL(photo.file) })));
    setPhotoStates(saved.photoStates);
    setResults(saved.results);
    setAnalysisErrors(saved.analysisErrors);
    setPublishedCount(saved.publishedCount);
    setPublishedExpiresAt(saved.publishedExpiresAt);
    setResumeRequested(saved.analyzing || saved.photos.some((photo) => saved.photoStates[photo.id]
      && saved.photoStates[photo.id].state !== 'done' && !saved.results.some((result) => result.photoId === photo.id)));
  });

  useEffect(() => {
    if (!draft.ready || !resumeRequested) return;
    setResumeRequested(false);
    void analyzePhotos(true);
    // Resume once after restoring a draft, never after an ordinary field edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.ready, resumeRequested]);

  const totalSize = useMemo(() => photos.reduce((sum, photo) => sum + photo.file.size, 0), [photos]);
  const totalLabels = useMemo(() => results.reduce((sum, invoice) => sum + invoice.labels.length, 0), [results]);
  const blockingLabels = useMemo(() => results.reduce((sum, invoice) => sum + invoice.labels.filter((label) => !labelReadyToPublish(label)).length, 0), [results]);
  const allReviewed = totalLabels > 0 && !analyzing && blockingLabels === 0;

  function resetAnalysis() {
    setResults([]);
    setAnalysisErrors([]);
    setPhotoStates({});
    setPublishError('');
  }

  function addFiles(fileList: FileList | null, source: 'camera' | 'gallery') {
    const files = fileList ? Array.from(fileList) : [];
    const incoming = files
      .filter((file) => file.size > 0)
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
      }));

    if (!incoming.length) {
      setCaptureMessage(source === 'camera'
        ? 'No se recibió la fotografía. Vuelve a hacerla y confirma el uso de la cámara si el móvil lo solicita.'
        : 'No se recibió ninguna imagen.');
      return;
    }

    setCaptureMessage(source === 'camera'
      ? '✓ Foto recibida. Ya puedes pulsar “Analizar y separar etiquetas”.'
      : `✓ ${incoming.length} ${incoming.length === 1 ? 'imagen recibida' : 'imágenes recibidas'}.`);
    setPublishedCount(null);
    resetAnalysis();
    setPhotos((current) => [...current, ...incoming]);
  }

  function clearAll() {
    if (analyzing || publishing) return;
    void discardAnalysisJobs(photos.map((photo) => photo.id), draft.scope).catch(() => {});
    photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    setPhotos([]);
    setCaptureMessage('');
    resetAnalysis();
  }

  async function analyzePhotos(resuming = false) {
    if (!photos.length || analyzing || !draft.ready) return;
    // Keep completed results and manual corrections. Only unfinished/failed photos
    // are submitted, using the same id to recover a response lost on navigation.
    const pending = photos.filter((photo) => !results.some((invoice) => invoice.photoId === photo.id));
    if (!pending.length) return;
    setAnalyzing(true);
    setAnalysisErrors([]);
    setPublishError('');
    const states = { ...photoStates, ...Object.fromEntries(pending.map((photo) => [photo.id, { state: 'pending' as const }])) };
    setPhotoStates(states);
    try {
      await draft.flush({ ...snapshot, analyzing: true, photoStates: states });
      // Upload all selected photos independently; OCR continues on the server
      // after each upload is acknowledged, even when the browser is suspended.
      await Promise.all(pending.map(async (photo) => {
        setPhotoStates((current) => ({ ...current, [photo.id]: { state: 'analyzing' } }));
        try {
          const optimized = await compressForUpload(photo.file);
          const payload = await analyzeSavedPhoto(photo.id, 'invoice', optimized, !resuming, draft.scope);
          const invoice = normalizeInvoice(photo, payload?.analysis || {});
          setResults((current) => [...current.filter((item) => item.photoId !== photo.id), invoice]
            .sort((a, b) => photos.findIndex((item) => item.id === a.photoId) - photos.findIndex((item) => item.id === b.photoId)));
          setPhotoStates((current) => ({ ...current, [photo.id]: { state: 'done', message: `${invoice.labels.length} ${invoice.labels.length === 1 ? 'etiqueta' : 'etiquetas'}` } }));
        } catch (error: any) {
          const message = `Factura ${photos.findIndex((item) => item.id === photo.id) + 1}: ${error?.message || 'error de lectura'}`;
          setAnalysisErrors((current) => [...current, message]);
          setPhotoStates((current) => ({ ...current, [photo.id]: { state: 'error', message } }));
        }
      }));
    } catch (error: any) {
      setAnalysisErrors([error?.message || 'No se pudo guardar el trabajo antes de analizarlo.']);
    } finally { setAnalyzing(false); }
  }

  function updateLabelField(invoiceIndex: number, labelIndex: number, field: LabelStringKey, value: string) {
    setResults((current) => current.map((invoice, ii) => ii !== invoiceIndex ? invoice : {
      ...invoice,
      labels: invoice.labels.map((label, li) => {
        if (li !== labelIndex) return label;
        const nextReview = value.trim() ? label.review_fields.filter((item) => item !== field) : label.review_fields;
        return { ...label, [field]: value, review_fields: nextReview, needs_review: nextReview.length > 0 };
      }),
    }));
  }

  function updateInvoiceField(invoiceIndex: number, field: InvoiceStringKey, value: string) {
    setResults((current) => current.map((invoice, index) => index === invoiceIndex ? { ...invoice, [field]: value } : invoice));
  }

  function confirmLabelReview(invoiceIndex: number, labelIndex: number) {
    setResults((current) => current.map((invoice, ii) => ii !== invoiceIndex ? invoice : {
      ...invoice,
      labels: invoice.labels.map((label, li) => li !== labelIndex ? label : (label.description.trim() && label.lote.trim() && label.procedencia.trim())
        ? { ...label, needs_review: false, review_fields: [] }
        : label),
    }));
  }

  async function publishLabels() {
    if (!allReviewed || publishing) return;
    setPublishing(true);
    setPublishError('');
    try {
      const response = await fetch('/api/publish-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await tenantAuthorizationHeader()) },
        body: JSON.stringify({ sourceMode: 'invoice', invoices: results }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'No se pudieron publicar las etiquetas.');
      void discardAnalysisJobs(photos.map((photo) => photo.id), draft.scope).catch(() => {});
      photos.forEach((photo) => URL.revokeObjectURL(photo.url));
      setPublishedCount(payload?.published || totalLabels);
      setPublishedExpiresAt(payload?.expires_at || '');
      setPhotos([]);
      setCaptureMessage('');
      setResults([]);
      setPhotoStates({});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      setPublishError(error?.message || 'Error al publicar las etiquetas.');
    } finally {
      setPublishing(false);
    }
  }

  if (publishedCount !== null) {
    return (
      <div className="min-h-screen bg-[#080b0d] px-5 py-12 text-white">
        <section className="mx-auto max-w-4xl rounded-[2rem] border border-emerald-400/25 bg-emerald-400/[.07] p-8 text-center sm:p-12">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-400/10 text-3xl">✓</div>
          <p className="mt-5 text-xs font-black uppercase tracking-[.22em] text-emerald-300">Publicación completada</p>
          <h1 className="mt-2 text-4xl font-black">{publishedCount} {publishedCount === 1 ? 'etiqueta definitiva' : 'etiquetas definitivas'}</h1>
          <p className="mt-4 text-slate-400">Vigencia de 72 horas desde la publicación.</p>
          {publishedExpiresAt ? <p className="mt-2 text-sm font-bold text-slate-500">Hasta {new Date(publishedExpiresAt).toLocaleString('es-ES')}</p> : null}
          <button onClick={() => setPublishedCount(null)} className="mt-7 rounded-2xl bg-orange-500 px-6 py-4 font-black text-[#111416]">📷 Analizar otra factura</button>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080b0d] text-white selection:bg-orange-500/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_5%,rgba(249,115,22,.16),transparent_26%),radial-gradient(circle_at_86%_18%,rgba(148,163,184,.08),transparent_24%)]" />
      <header className="relative border-b border-white/10 bg-[#0c1013]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href={employeeMode ? invoiceRoute : '/'} className="flex items-center gap-4"><div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-orange-400/20 bg-black"><Image src="/ca46-logo.svg" alt="CA46" fill priority sizes="56px" className="object-cover" /></div><div><p className="text-xl font-black">CA46</p><p className="text-xs font-semibold text-slate-500">Creador de etiquetas</p></div></Link>
          <Link href={employeeMode ? invoiceRoute : '/'} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">{employeeMode ? 'Crear etiquetas' : '← Inicio'}</Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <p role="status" className="mx-auto mb-5 max-w-5xl text-center text-sm text-slate-400">{draft.message}</p>
        <nav aria-label="Tipo de documento" className="mx-auto mb-8 grid max-w-3xl grid-cols-2 gap-3">
          <Link href={invoiceRoute} aria-current="page" className="rounded-2xl border border-orange-400/50 bg-orange-500/15 px-4 py-4 text-center font-black text-orange-300">Factura · 72 h</Link>
          <Link href={boxRoute} className="rounded-2xl border border-white/20 bg-white/5 px-4 py-4 text-center font-black text-slate-200 hover:border-amber-400/50">Etiqueta de caja · 24 h</Link>
        </nav>
        <section className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-orange-400/20 bg-orange-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.22em] text-orange-300">Factura · definitiva · 72 horas</span>
          <h1 className="mt-5 text-4xl font-black sm:text-6xl">De la factura a las etiquetas</h1>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-400">Selecciona una o varias facturas. CA46 separa cada partida, te deja revisarla y la publica únicamente en tu empresa.</p>
          <p className="mt-3 text-sm text-slate-400">¿Tienes la etiqueta de una caja y todavía no la factura? <Link href={boxRoute} className="font-bold text-amber-300 underline underline-offset-4">Crear etiqueta de 24 horas</Link></p>
        </section>

        <section className="mx-auto mt-9 grid max-w-5xl gap-5 md:grid-cols-2">
          <button onClick={() => cameraInput.current?.click()} disabled={!draft.ready || analyzing || publishing} className="rounded-[2rem] border border-orange-400/25 bg-orange-500/[.08] p-8 text-left disabled:opacity-50"><div className="text-4xl">📷</div><p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-orange-400">Desde el móvil</p><h2 className="mt-2 text-3xl font-black">Hacer foto</h2><p className="mt-3 text-slate-400">Factura completa, recta y con buena luz.</p></button>
          <button onClick={() => galleryInput.current?.click()} disabled={!draft.ready || analyzing || publishing} className="rounded-[2rem] border border-white/10 bg-white/[.04] p-8 text-left disabled:opacity-50"><div className="text-4xl">🖼️</div><p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-slate-500">Selección múltiple</p><h2 className="mt-2 text-3xl font-black">Elegir facturas</h2><p className="mt-3 text-slate-400">Procesa varias imágenes seguidas.</p></button>
          <input ref={cameraInput} type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files, 'camera'); e.currentTarget.value = ''; }} />
          <input ref={galleryInput} type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif" multiple className="hidden" onChange={(e) => { addFiles(e.target.files, 'gallery'); e.currentTarget.value = ''; }} />
        </section>

        {captureMessage ? <p aria-live="polite" className={`mx-auto mt-4 max-w-5xl rounded-2xl border px-4 py-3 text-sm font-bold ${captureMessage.startsWith('✓') ? 'border-emerald-400/20 bg-emerald-400/[.06] text-emerald-200' : 'border-amber-400/20 bg-amber-400/[.06] text-amber-100'}`}>{captureMessage}</p> : null}

        <section className="mx-auto mt-8 max-w-5xl rounded-[2rem] border border-white/10 bg-white/[.035] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">Paso 1</p><h2 className="mt-2 text-2xl font-black">{photos.length ? `${photos.length} ${photos.length === 1 ? 'factura' : 'facturas'} seleccionadas` : 'Añade facturas para empezar'}</h2>{photos.length ? <p className="mt-2 text-sm text-slate-500">{(totalSize / 1024 / 1024).toFixed(1)} MB originales</p> : null}</div>{photos.length && !analyzing ? <button onClick={clearAll} className="rounded-full border border-white/10 px-4 py-2 text-sm font-black text-slate-400">Quitar todas</button> : null}</div>
          {photos.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{photos.map((photo, index) => <div key={photo.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"><img src={photo.url} alt={`Factura ${index + 1}`} className="aspect-[4/3] w-full object-cover"/><div className="p-3"><p className="truncate text-sm font-bold">Factura {index + 1} · {photo.file.name || 'foto'}</p>{photoStates[photo.id] ? <p className="mt-1 text-xs font-black text-orange-300">{photoStates[photo.id].state === 'analyzing' ? 'Analizando…' : photoStates[photo.id].message || 'En cola'}</p> : null}</div></div>)}</div> : null}
          <button onClick={() => void analyzePhotos()} disabled={!draft.ready || !photos.length || analyzing || publishing} className="mt-6 w-full rounded-2xl bg-orange-500 px-6 py-4 text-lg font-black text-[#111416] disabled:bg-slate-800 disabled:text-slate-600">{analyzing ? 'Interpretando facturas de compra…' : `Analizar y separar etiquetas (${photos.length})`}</button>
          {analysisErrors.length ? <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/[.07] p-4 text-sm text-rose-200">{analysisErrors.map((item) => <p key={item}>• {item}</p>)}</div> : null}
        </section>

        {results.length ? <section className="mx-auto mt-8 max-w-6xl space-y-6">
          <div className="rounded-[2rem] border border-orange-400/20 bg-orange-500/[.06] p-6"><p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">Paso 2 · Revisión</p><h2 className="mt-2 text-3xl font-black">{totalLabels} {totalLabels === 1 ? 'etiqueta' : 'etiquetas'} generadas</h2><p className="mt-2 text-slate-400">Especie, lote y procedencia deben estar correctos antes de publicar.</p></div>
          {results.map((invoice, invoiceIndex) => <article key={invoice.photoId} className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.035]">
            <header className="border-b border-white/10 bg-black/20 p-5"><p className="text-xs font-black uppercase tracking-[.18em] text-orange-400">{invoice.fileName}</p><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{INVOICE_FIELDS.map((field) => <label key={field.key} className={field.wide ? 'sm:col-span-2' : ''}><span className="mb-2 block text-[10px] font-black uppercase tracking-[.14em] text-slate-500">{field.label}</span><input value={invoice[field.key]} onChange={(e) => updateInvoiceField(invoiceIndex, field.key, e.target.value)} className={inputClass}/></label>)}</div></header>
            <div className="space-y-5 p-5">{invoice.labels.map((label, labelIndex) => <div key={`${invoice.photoId}-${labelIndex}`} className={`rounded-2xl border p-5 ${label.needs_review ? 'border-amber-400/25 bg-amber-400/[.035]' : 'border-white/10 bg-black/20'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-2xl font-black">{label.description || `Etiqueta ${labelIndex + 1}`}</h3><span className={`rounded-full px-3 py-1 text-xs font-black ${label.needs_review ? 'bg-amber-400/10 text-amber-300' : 'bg-emerald-400/10 text-emerald-300'}`}>{label.needs_review ? '⚠ Revisar' : '✓ Lista'}</span></div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{LABEL_FIELDS.map((field) => { const flagged = label.review_fields.includes(field.key); return <label key={field.key} className={field.wide ? 'sm:col-span-2' : ''}><span className={`mb-2 block text-[10px] font-black uppercase tracking-[.14em] ${flagged || field.important ? 'text-amber-300' : 'text-slate-500'}`}>{field.label}{flagged ? ' · revisar' : ''}</span><input value={label[field.key] || ''} onChange={(e) => updateLabelField(invoiceIndex, labelIndex, field.key, e.target.value)} className={inputClass}/></label>; })}</div>
              {label.needs_review ? <button onClick={() => confirmLabelReview(invoiceIndex, labelIndex)} disabled={!label.description.trim() || !label.lote.trim() || !label.procedencia.trim()} className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm font-black text-amber-200 disabled:opacity-30">✓ Confirmar revisión</button> : null}
            </div>)}</div>
          </article>)}
          <div className="rounded-[2rem] border border-white/10 bg-white/[.035] p-6 sm:flex sm:items-center sm:justify-between sm:gap-6"><div><p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">Paso 3</p><h3 className="mt-2 text-2xl font-black">Publicar · 72 horas</h3>{!allReviewed ? <p className="mt-2 text-sm font-bold text-amber-300">{blockingLabels} {blockingLabels === 1 ? 'etiqueta necesita' : 'etiquetas necesitan'} revisión.</p> : <p className="mt-2 text-sm font-bold text-emerald-300">✓ Listo para publicar en tu empresa.</p>}{publishError ? <p className="mt-2 text-sm font-bold text-rose-300">{publishError}</p> : null}</div><button onClick={publishLabels} disabled={!allReviewed || publishing || analyzing} className="mt-5 w-full rounded-2xl bg-orange-500 px-6 py-4 font-black text-[#111416] disabled:bg-slate-800 disabled:text-slate-600 sm:mt-0 sm:w-auto">{publishing ? 'Publicando…' : `Publicar ${totalLabels}`}</button></div>
        </section> : null}
      </main>
    </div>
  );
}
