'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { tenantAuthorizationHeader } from '@/lib/tenant-company-config';
import { useCreatorDraft } from '@/lib/use-creator-draft';
import { analyzeSavedPhoto, discardAnalysisJobs } from '@/lib/label-analysis-client';

type ExtraField = { label: string; value: string };
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

type PhysicalWork = { file: File | null; jobId: string; label: LabelDraft; warnings: string[]; analyzing: boolean; error: string; publishedExpiresAt: string };

const EMPTY_LABEL: LabelDraft = {
  description: '', scientific_name: '', lote: '', marca: '', kg_neto: '', metodo: '', presentacion: '',
  procedencia: '', fao: '', frescura: '', arte: '', ce: '', subzona: '', primer_expedidor: '', poblacion: '',
  fecha_captura: '', comprador: '', nif: '', extra_fields: [], confidence: 0, needs_review: true, review_fields: [],
};

const FIELDS: Array<{
  key: keyof Omit<LabelDraft, 'extra_fields' | 'confidence' | 'needs_review' | 'review_fields'>;
  label: string;
  wide?: boolean;
  critical?: boolean;
}> = [
  { key: 'description', label: 'Especie', wide: true, critical: true },
  { key: 'scientific_name', label: 'Nombre científico', wide: true },
  { key: 'lote', label: 'Lote', wide: true, critical: true },
  { key: 'procedencia', label: 'Procedencia', wide: true, critical: true },
  { key: 'fao', label: 'FAO' },
  { key: 'metodo', label: 'Método de producción', wide: true },
  { key: 'frescura', label: 'Frescura' },
  { key: 'arte', label: 'Arte de pesca', wide: true },
  { key: 'kg_neto', label: 'Peso neto (kg)' },
  { key: 'presentacion', label: 'Presentación' },
  { key: 'ce', label: 'CE / registro partida' },
  { key: 'marca', label: 'Marca' },
  { key: 'subzona', label: 'Subzona' },
  { key: 'primer_expedidor', label: 'Primer expedidor', wide: true },
  { key: 'poblacion', label: 'Población' },
  { key: 'fecha_captura', label: 'Fecha de captura' },
  { key: 'comprador', label: 'Comprador', wide: true },
  { key: 'nif', label: 'NIF comprador' },
];

const CRITICAL = new Set(['description', 'lote', 'procedencia']);
const inputClass = 'w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-amber-400';

function isSupportedImage(file: File) {
  if (!file || file.size <= 0) return false;
  if (String(file.type || '').toLowerCase().startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(file.name || '');
}

async function compressForUpload(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 2200;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.84));
    if (!blob) return file;
    const baseName = file.name?.replace(/\.[^.]+$/, '') || `etiqueta-${Date.now()}`;
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

export default function PhysicalLabelCreator({ employeeMode = false }: { employeeMode?: boolean }) {
  const invoiceRoute = employeeMode ? '/empleado/etiquetas' : '/creador-etiquetas';
  const boxRoute = employeeMode ? '/empleado/etiqueta-caja' : '/creador-etiquetas/etiqueta-temporal';
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [label, setLabel] = useState<LabelDraft>(EMPTY_LABEL);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [captureMessage, setCaptureMessage] = useState('');
  const [publishedExpiresAt, setPublishedExpiresAt] = useState('');
  const [jobId, setJobId] = useState('');
  const [resumeRequested, setResumeRequested] = useState(false);
  const snapshot = useMemo<PhysicalWork>(() => ({ file, jobId, label, warnings, analyzing, error, publishedExpiresAt }),
    [file, jobId, label, warnings, analyzing, error, publishedExpiresAt]);
  const draft = useCreatorDraft('physical_label', snapshot, (saved) => {
    setFile(saved.file);
    setJobId(saved.jobId);
    setPreview(saved.file ? URL.createObjectURL(saved.file) : '');
    setLabel(saved.label);
    setWarnings(saved.warnings);
    setError(saved.error);
    setPublishedExpiresAt(saved.publishedExpiresAt);
    setResumeRequested(saved.analyzing || Boolean(saved.error && saved.file && !saved.label.description));
  });

  useEffect(() => {
    if (!draft.ready || !resumeRequested) return;
    setResumeRequested(false);
    void analyze(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.ready, resumeRequested]);

  const criticalPending = useMemo(() => {
    const pendingReview = label.review_fields.some((field) => CRITICAL.has(field));
    return pendingReview || !label.description.trim() || !label.lote.trim() || !label.procedencia.trim();
  }, [label]);

  function chooseFile(selected: File | null, source: 'camera' | 'gallery') {
    if (!selected || !isSupportedImage(selected)) {
      setCaptureMessage(source === 'camera'
        ? 'No se recibió la fotografía. Vuelve a hacerla y confirma el uso de la cámara.'
        : 'No se recibió una imagen compatible.');
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    if (jobId) void discardAnalysisJobs([jobId], draft.scope).catch(() => {});
    setJobId(crypto.randomUUID());
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setLabel(EMPTY_LABEL);
    setWarnings([]);
    setError('');
    setPublishedExpiresAt('');
    setCaptureMessage(source === 'camera' ? '✓ Foto de la etiqueta recibida.' : '✓ Imagen de la etiqueta recibida.');
  }

  function patchField(
    key: keyof Omit<LabelDraft, 'extra_fields' | 'confidence' | 'needs_review' | 'review_fields'>,
    value: string,
  ) {
    setLabel((current) => {
      const nextReview = value.trim() ? current.review_fields.filter((field) => field !== key) : current.review_fields;
      return { ...current, [key]: value, review_fields: nextReview, needs_review: nextReview.length > 0 };
    });
  }

  async function analyze(resuming = false) {
    if (!file || analyzing || !draft.ready) return;
    setAnalyzing(true);
    setError('');
    setWarnings([]);
    try {
      await draft.flush({ ...snapshot, analyzing: true });
      const optimized = await compressForUpload(file);
      const payload = await analyzeSavedPhoto(jobId, 'physical_label', optimized, !resuming, draft.scope);
      const next = payload?.analysis?.labels?.[0];
      if (!next) throw new Error('No se ha encontrado una etiqueta válida en la fotografía.');
      setLabel({
        ...EMPTY_LABEL,
        ...next,
        extra_fields: Array.isArray(next.extra_fields) ? next.extra_fields : [],
        review_fields: Array.isArray(next.review_fields) ? next.review_fields : [],
      });
      setWarnings(Array.isArray(payload?.analysis?.warnings) ? payload.analysis.warnings : []);
    } catch (requestError: any) {
      setError(requestError?.message || 'No se pudo analizar la etiqueta.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function publish() {
    if (criticalPending || publishing) return;
    setPublishing(true);
    setError('');
    try {
      const response = await fetch('/api/publish-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await tenantAuthorizationHeader()) },
        body: JSON.stringify({
          sourceMode: 'physical_label',
          invoices: [{
            invoice_number: '',
            invoice_date: '',
            expedidor: '',
            cif_expedidor: '',
            registro_sanitario_expedidor: '',
            buyer: label.comprador,
            buyer_nif: label.nif,
            invoice_extra_fields: [],
            labels: [label],
          }],
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'No se pudo publicar la etiqueta temporal.');
      setPublishedExpiresAt(payload?.expires_at || '');
      void discardAnalysisJobs([jobId], draft.scope).catch(() => {});
    } catch (requestError: any) {
      setError(requestError?.message || 'No se pudo publicar la etiqueta temporal.');
    } finally {
      setPublishing(false);
    }
  }

  function reset() {
    if (analyzing || publishing) return;
    if (jobId) void discardAnalysisJobs([jobId], draft.scope).catch(() => {});
    setJobId('');
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview('');
    setLabel(EMPTY_LABEL);
    setWarnings([]);
    setError('');
    setCaptureMessage('');
    setPublishedExpiresAt('');
  }

  if (publishedExpiresAt) {
    return (
      <div className="min-h-screen bg-[#080b0d] px-5 py-12 text-white">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-amber-400/30 bg-amber-400/[.07] p-8 text-center sm:p-12">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-400/10 text-3xl">✓</div>
          <p className="mt-5 text-xs font-black uppercase tracking-[.22em] text-amber-300">Temporal activa · factura pendiente</p>
          <h1 className="mt-2 text-4xl font-black">Activa durante 24 horas</h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-400">Se ha creado desde la etiqueta física de la caja. Al cumplirse 24 horas dejará de mostrarse automáticamente.</p>
          <p className="mt-4 text-sm font-black text-amber-200">Caduca: {new Date(publishedExpiresAt).toLocaleString('es-ES')}</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <button onClick={reset} className="rounded-2xl bg-amber-400 px-5 py-4 font-black text-[#111416]">🏷️ Crear otra temporal</button>
            {!employeeMode ? <Link href="/etiquetas" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-black">👁️ Ver etiquetas</Link> : null}
            <Link href={invoiceRoute} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-black">📄 Factura · 72 h</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080b0d] text-white selection:bg-amber-500/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_5%,rgba(251,191,36,.14),transparent_27%),radial-gradient(circle_at_90%_10%,rgba(249,115,22,.08),transparent_25%)]" />

      <header className="relative border-b border-white/10 bg-[#0c1013]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href={employeeMode ? invoiceRoute : '/crear'} className="flex items-center gap-4">
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-amber-400/20 bg-black">
              <Image src="/ca46-logo.svg" alt="CA46" fill priority sizes="56px" className="object-cover" />
            </div>
            <div><p className="text-xl font-black">CA46</p><p className="text-xs font-semibold text-slate-500">Etiqueta temporal</p></div>
          </Link>
          <Link href={employeeMode ? invoiceRoute : '/crear'} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black">{employeeMode ? 'Factura · 72 h' : '← Crear'}</Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <p role="status" className="mx-auto mb-5 max-w-4xl text-center text-sm text-slate-400">{draft.message}</p>
        <nav aria-label="Tipo de documento" className="mx-auto mb-8 grid max-w-3xl grid-cols-2 gap-3">
          <Link href={invoiceRoute} className="rounded-2xl border border-white/20 bg-white/5 px-4 py-4 text-center font-black text-slate-200 hover:border-orange-400/50">Factura · 72 h</Link>
          <Link href={boxRoute} aria-current="page" className="rounded-2xl border border-amber-400/50 bg-amber-400/15 px-4 py-4 text-center font-black text-amber-300">Etiqueta de caja · 24 h</Link>
        </nav>
        <section className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.2em] text-amber-300">Temporal · 24 horas · factura pendiente</span>
          <h1 className="mt-5 text-4xl font-black sm:text-6xl">Fotografía la etiqueta de la caja</h1>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-400">Cuando todavía no ha llegado la factura, CA46 copia la trazabilidad visible de la etiqueta física y crea una ficha temporal activa durante 24 horas.</p>
        </section>

        <section className="mx-auto mt-9 grid max-w-4xl gap-4 sm:grid-cols-2">
          <button type="button" onClick={() => cameraInput.current?.click()} disabled={!draft.ready || analyzing || publishing} className="rounded-[2rem] border border-amber-400/30 bg-amber-400/[.07] p-7 text-left disabled:opacity-50">
            <div className="text-4xl">📷</div><p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-amber-300">Desde el móvil</p><h2 className="mt-2 text-2xl font-black">Hacer foto</h2><p className="mt-2 text-sm text-slate-400">Encuadra la etiqueta completa, recta y con buena luz.</p>
          </button>
          <button type="button" onClick={() => galleryInput.current?.click()} disabled={!draft.ready || analyzing || publishing} className="rounded-[2rem] border border-white/10 bg-white/[.035] p-7 text-left disabled:opacity-50">
            <div className="text-4xl">🖼️</div><p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-slate-500">Desde el dispositivo</p><h2 className="mt-2 text-2xl font-black">Elegir imagen</h2><p className="mt-2 text-sm text-slate-400">Utiliza una fotografía que ya tengas guardada.</p>
          </button>
          <input ref={cameraInput} type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif" capture="environment" className="hidden" onChange={(event) => { chooseFile(event.target.files?.[0] || null, 'camera'); event.currentTarget.value = ''; }} />
          <input ref={galleryInput} type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif" className="hidden" onChange={(event) => { chooseFile(event.target.files?.[0] || null, 'gallery'); event.currentTarget.value = ''; }} />
        </section>

        {captureMessage ? <p className={`mx-auto mt-4 max-w-4xl rounded-2xl border px-5 py-4 text-sm font-bold ${captureMessage.startsWith('✓') ? 'border-emerald-400/20 bg-emerald-400/[.06] text-emerald-200' : 'border-amber-400/20 bg-amber-400/[.06] text-amber-100'}`}>{captureMessage}</p> : null}

        {file ? (
          <section className="mx-auto mt-6 max-w-4xl rounded-[2rem] border border-white/10 bg-white/[.035] p-6 sm:p-8">
            <div className="grid gap-6 md:grid-cols-[.75fr_1.25fr]">
              <div>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black"><img src={preview} alt="Etiqueta física" className="aspect-[4/3] h-full w-full object-contain" /></div>
                <button onClick={reset} disabled={analyzing || publishing} className="mt-3 w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-500">Quitar foto</button>
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Paso 1</p>
                <h2 className="mt-2 text-3xl font-black">Leer trazabilidad</h2>
                <p className="mt-3 leading-7 text-slate-400">Se leerán todos los datos visibles de la etiqueta de la caja. En esta vía no se exige el N.º de comprador / cliente de tu Merca.</p>
                <button onClick={() => void analyze()} disabled={!draft.ready || analyzing || publishing} className="mt-6 rounded-2xl bg-amber-400 px-5 py-4 text-lg font-black text-[#111416] disabled:opacity-50">{analyzing ? 'Leyendo etiqueta…' : 'Analizar etiqueta física'}</button>
              </div>
            </div>
          </section>
        ) : null}

        {error ? <p className="mx-auto mt-6 max-w-4xl rounded-2xl border border-rose-400/20 bg-rose-500/[.07] px-5 py-4 text-sm font-bold text-rose-200">{error}</p> : null}
        {warnings.length ? <div className="mx-auto mt-6 max-w-4xl rounded-2xl border border-amber-400/20 bg-amber-400/[.06] p-5 text-sm text-amber-100">{warnings.map((warning) => <p key={warning}>• {warning}</p>)}</div> : null}

        {(label.description || label.lote || label.procedencia || label.review_fields.length > 0) ? (
          <section className="mx-auto mt-8 max-w-5xl rounded-[2rem] border border-amber-400/20 bg-white/[.035] p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Paso 2 · Revisión</p><h2 className="mt-2 text-3xl font-black">Temporal · factura pendiente</h2></div>
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-black text-amber-300">Activa 24 h</span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FIELDS.map((field) => {
                const needsReview = label.review_fields.includes(field.key);
                return (
                  <label key={field.key} className={field.wide ? 'sm:col-span-2' : ''}>
                    <span className={`mb-2 block text-[11px] font-black uppercase tracking-[.15em] ${needsReview || (field.critical && !label[field.key]) ? 'text-amber-300' : 'text-slate-500'}`}>
                      {field.label}{field.critical ? ' · obligatorio' : ''}{needsReview ? ' · revisar' : ''}
                    </span>
                    <input value={String(label[field.key] || '')} onChange={(event) => patchField(field.key, event.target.value)} className={`${inputClass} ${needsReview ? 'border-amber-400/50' : ''}`} />
                  </label>
                );
              })}
            </div>

            {label.extra_fields.length ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-black uppercase tracking-[.18em] text-slate-500">Otros datos de trazabilidad leídos</p>
                <div className="mt-3 flex flex-wrap gap-2">{label.extra_fields.map((item) => <span key={`${item.label}-${item.value}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300">{item.label}: {item.value}</span>)}</div>
              </div>
            ) : null}

            {criticalPending ? <p className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/[.06] px-5 py-4 text-sm font-bold text-amber-200">Revisa especie, lote y procedencia antes de publicar.</p> : null}
            <button onClick={publish} disabled={criticalPending || publishing || analyzing} className="mt-6 w-full rounded-2xl bg-amber-400 px-6 py-4 text-lg font-black text-[#111416] disabled:bg-slate-800 disabled:text-slate-600">{publishing ? 'Publicando…' : 'Activar etiqueta temporal · 24 h'}</button>
            <p className="mt-3 text-center text-xs text-slate-600">La vigencia empieza al publicarla. Al cumplir 24 horas se desactiva automáticamente.</p>
          </section>
        ) : null}
      </main>
    </div>
  );
}
