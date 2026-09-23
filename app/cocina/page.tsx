'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { decodeTraceability } from '@/lib/traceability';

type Tag = {
  id: string;
  product_name: string;
  origin: string | null;
  category: string;
  source: string;
  status: string;
  expires_at: string;
  parent_tag_id?: string | null;
};
type Transformation = {
  id: string;
  parent_tag_id: string;
  child_tag_id: string | null;
  process_type: string;
  processed_at: string;
  input_weight_kg: number;
  output_weight_kg: number;
  salt_grams: number;
  output_product_name: string;
  output_lot: string;
};
type Ingredient = { name: string; quantity: string };
type Nutrition = { energyKcal: string; proteinG: string; carbsG: string; sugarsG: string; fatG: string; saturatedFatG: string; saltG: string };

const fieldClass = 'w-full rounded-xl border border-white/10 bg-[#11161a] px-4 py-3 font-bold text-white outline-none focus:border-orange-400';
const emptyNutrition: Nutrition = { energyKcal: '', proteinG: '', carbsG: '', sugarsG: '', fatG: '', saturatedFatG: '', saltG: '' };

export default function CocinaPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [history, setHistory] = useState<Transformation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [parentTagId, setParentTagId] = useState('');
  const [processType, setProcessType] = useState('Cocción');
  const [outputProductName, setOutputProductName] = useState('');
  const [outputLot, setOutputLot] = useState('');
  const [inputWeightKg, setInputWeightKg] = useState('');
  const [outputWeightKg, setOutputWeightKg] = useState('');
  const [saltGrams, setSaltGrams] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: '', quantity: '' }]);
  const [nutrition, setNutrition] = useState<Nutrition>(emptyNutrition);
  const [notes, setNotes] = useState('');

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  }

  async function load() {
    setLoading(true); setError('');
    try {
      const accessToken = await token();
      if (!accessToken) throw new Error('Inicia sesión para usar Cocina.');
      const response = await fetch('/api/kitchen', { cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo cargar Cocina.');
      setTags(payload.tags || []);
      setHistory(payload.transformations || []);
      if (!parentTagId && payload.tags?.[0]) setParentTagId(payload.tags[0].id);
    } catch (e: any) { setError(e?.message || 'No se pudo cargar Cocina.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const parent = useMemo(() => tags.find((tag) => tag.id === parentTagId) || null, [tags, parentTagId]);
  const parentTrace = parent ? decodeTraceability(parent.category) : null;

  useEffect(() => {
    if (!parent) return;
    if (!outputProductName) setOutputProductName(`${parent.product_name} cocinado`);
    if (!outputLot) setOutputLot(parentTrace?.lot ? `${parentTrace.lot}-C` : '');
    if (!inputWeightKg && parentTrace?.netWeight) {
      const parsed = Number(String(parentTrace.netWeight).replace(',', '.').replace(/[^0-9.]/g, ''));
      if (Number.isFinite(parsed) && parsed > 0) setInputWeightKg(String(parsed));
    }
  }, [parentTagId]);

  function ingredient(index: number, key: keyof Ingredient, value: string) {
    setIngredients((current) => current.map((item, i) => i === index ? { ...item, [key]: value } : item));
  }

  async function save() {
    const input = Number(inputWeightKg.replace(',', '.'));
    const output = Number(outputWeightKg.replace(',', '.'));
    const salt = Number((saltGrams || '0').replace(',', '.'));
    if (!parentTagId || !processType.trim() || !outputProductName.trim() || !Number.isFinite(input) || input <= 0 || !Number.isFinite(output) || output <= 0) {
      setError('Selecciona el lote de origen e indica proceso, producto final y los dos pesos.');
      return;
    }
    if (output > input * 1.5 && !window.confirm('El peso final supera ampliamente al peso de entrada. ¿Quieres guardarlo así?')) return;

    setSaving(true); setError(''); setMessage('');
    try {
      const accessToken = await token();
      const response = await fetch('/api/kitchen', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentTagId,
          processType,
          outputProductName,
          outputLot,
          inputWeightKg: input,
          outputWeightKg: output,
          saltGrams: Number.isFinite(salt) ? salt : 0,
          ingredients: ingredients.filter((item) => item.name.trim()),
          nutrition: Object.fromEntries(Object.entries(nutrition).map(([key, value]) => [key, Number(String(value || '0').replace(',', '.')) || 0])),
          notes,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo guardar.');
      setMessage(`Transformación guardada. Se ha creado la etiqueta hija ${payload.transformation?.output_lot || ''} sin romper la trazabilidad.`);
      setOutputWeightKg(''); setSaltGrams(''); setIngredients([{ name: '', quantity: '' }]); setNutrition(emptyNutrition); setNotes(''); setOutputProductName(''); setOutputLot('');
      await load();
    } catch (e: any) { setError(e?.message || 'No se pudo guardar la transformación.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="min-h-screen bg-[#080b0d] text-white">
      <header className="border-b border-white/10 bg-[#0c1013]/95 px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[.2em] text-orange-400">CA46 · Trazabilidad</p><h1 className="mt-1 text-2xl font-black">Pantalla Cocina</h1></div>
          <Link href="/crear" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">← Etiquetas</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <section className="rounded-[2rem] border border-orange-400/20 bg-orange-500/[.06] p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[.18em] text-orange-400">Padre → transformación → hijo</p>
          <h2 className="mt-2 text-3xl font-black">Cocinar sin perder el origen</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Elige una etiqueta existente, registra lo que haces en cocina y CA46 crea una nueva etiqueta hija. El lote original siempre queda enlazado.</p>
        </section>

        {error ? <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/[.07] px-5 py-4 font-bold text-rose-300">{error}</div> : null}
        {message ? <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/[.07] px-5 py-4 font-bold text-emerald-300">{message}</div> : null}
        {loading ? <div className="mt-6 h-48 animate-pulse rounded-[2rem] border border-white/10 bg-white/[.03]" /> : null}

        {!loading ? <>
          <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-7">
            <h2 className="text-2xl font-black">1. Producto de origen</h2>
            {tags.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center text-sm font-bold text-slate-500">No hay etiquetas activas. Crea o importa una etiqueta antes de entrar en Cocina.</div> : <>
              <label className="mt-5 block"><Label>Etiqueta / lote</Label><select className={fieldClass} value={parentTagId} onChange={(e) => { setParentTagId(e.target.value); setOutputProductName(''); setOutputLot(''); setInputWeightKg(''); }}>{tags.map((tag) => { const trace = decodeTraceability(tag.category); return <option key={tag.id} value={tag.id}>{tag.product_name} · {trace?.lot || 'sin lote'}{tag.source === 'kitchen' ? ' · cocina' : ''}</option>; })}</select></label>
              {parent ? <div className="mt-4 grid gap-3 sm:grid-cols-3"><Info label="Producto" value={parent.product_name} /><Info label="Lote padre" value={parentTrace?.lot || '—'} /><Info label="Procedencia" value={parentTrace?.origin || parent.origin || '—'} /></div> : null}
            </>}
          </section>

          <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-7">
            <h2 className="text-2xl font-black">2. Proceso y rendimiento</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <label><Label>Proceso</Label><select className={fieldClass} value={processType} onChange={(e) => setProcessType(e.target.value)}><option>Cocción</option><option>Cocción + salmuera</option><option>Horneado</option><option>Plancha</option><option>Vapor</option><option>Otro proceso</option></select></label>
              <label><Label>Peso antes de cocinar (kg)</Label><input className={fieldClass} inputMode="decimal" value={inputWeightKg} onChange={(e) => setInputWeightKg(e.target.value)} placeholder="4,000" /></label>
              <label><Label>Peso final cocinado (kg)</Label><input className={fieldClass} inputMode="decimal" value={outputWeightKg} onChange={(e) => setOutputWeightKg(e.target.value)} placeholder="3,250" /></label>
              <label><Label>Producto final</Label><input className={fieldClass} value={outputProductName} onChange={(e) => setOutputProductName(e.target.value)} placeholder="Langostino cocido" /></label>
              <label><Label>Lote hijo</Label><input className={fieldClass} value={outputLot} onChange={(e) => setOutputLot(e.target.value)} placeholder="Se genera si lo dejas vacío" /></label>
              <label><Label>Sal usada / salmuera (g)</Label><input className={fieldClass} inputMode="decimal" value={saltGrams} onChange={(e) => setSaltGrams(e.target.value)} placeholder="0" /></label>
            </div>
          </section>

          <section className="mt-6 rounded-[2rem] border border-sky-400/20 bg-sky-400/[.04] p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-sky-300">Ingredientes y aditivos</p><h2 className="mt-1 text-2xl font-black">3. Qué has añadido</h2></div><button type="button" onClick={() => setIngredients((current) => [...current, { name: '', quantity: '' }])} className="rounded-xl border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-sm font-black text-sky-200">+ Añadir</button></div>
            <div className="mt-5 space-y-3">{ingredients.map((item, index) => <div key={index} className="grid gap-3 sm:grid-cols-[1fr_.55fr_auto]"><input className={fieldClass} value={item.name} onChange={(e) => ingredient(index, 'name', e.target.value)} placeholder="Ej.: sal, limón, conservante…" /><input className={fieldClass} value={item.quantity} onChange={(e) => ingredient(index, 'quantity', e.target.value)} placeholder="Ej.: 25 g" /><button type="button" onClick={() => setIngredients((current) => current.filter((_, i) => i !== index))} className="rounded-xl border border-white/10 px-4 font-black text-slate-400">×</button></div>)}</div>
          </section>

          <section className="mt-6 rounded-[2rem] border border-emerald-400/20 bg-emerald-400/[.04] p-5 sm:p-7">
            <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-300">Por 100 gramos</p><h2 className="mt-1 text-2xl font-black">4. Valor nutricional del producto terminado</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><NutritionInput label="Energía kcal" value={nutrition.energyKcal} onChange={(value) => setNutrition({ ...nutrition, energyKcal: value })} /><NutritionInput label="Proteínas g" value={nutrition.proteinG} onChange={(value) => setNutrition({ ...nutrition, proteinG: value })} /><NutritionInput label="Hidratos g" value={nutrition.carbsG} onChange={(value) => setNutrition({ ...nutrition, carbsG: value })} /><NutritionInput label="Azúcares g" value={nutrition.sugarsG} onChange={(value) => setNutrition({ ...nutrition, sugarsG: value })} /><NutritionInput label="Grasas g" value={nutrition.fatG} onChange={(value) => setNutrition({ ...nutrition, fatG: value })} /><NutritionInput label="Saturadas g" value={nutrition.saturatedFatG} onChange={(value) => setNutrition({ ...nutrition, saturatedFatG: value })} /><NutritionInput label="Sal g" value={nutrition.saltG} onChange={(value) => setNutrition({ ...nutrition, saltG: value })} /></div>
            <label className="mt-4 block"><Label>Observaciones</Label><textarea className={`${fieldClass} min-h-24`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" /></label>
            <button type="button" disabled={saving || tags.length === 0} onClick={() => void save()} className="mt-5 w-full rounded-xl bg-orange-500 px-5 py-4 text-lg font-black text-black disabled:opacity-40">{saving ? 'Guardando transformación…' : 'Guardar y crear etiqueta hija'}</button>
          </section>

          <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-7">
            <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Trazabilidad</p><h2 className="mt-1 text-2xl font-black">Últimas transformaciones</h2></div><button onClick={() => void load()} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">Actualizar</button></div>
            <div className="mt-5 space-y-3">{history.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 px-4 py-7 text-center text-sm font-bold text-slate-600">Todavía no hay transformaciones.</p> : history.map((row) => <div key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black">{row.output_product_name}</p><p className="mt-1 text-xs font-bold text-slate-500">{row.process_type} · lote {row.output_lot}</p></div><p className="text-sm font-black text-orange-300">{row.input_weight_kg} kg → {row.output_weight_kg} kg</p></div></div>)}</div>
          </section>
        </> : null}
      </main>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) { return <span className="mb-2 block text-[11px] font-black uppercase tracking-[.14em] text-slate-500">{children}</span>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-600">{label}</p><p className="mt-1 font-black text-slate-200">{value}</p></div>; }
function NutritionInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><Label>{label}</Label><input className={fieldClass} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" /></label>; }
