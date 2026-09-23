'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Equipment = { id: string; name: string; equipment_type: 'fresh_room' | 'freezer' | 'other'; min_temp_c: number; max_temp_c: number };
type Reading = { id: string; equipment_id: string; measured_at: string; temperature_c: number; min_temp_c_snapshot: number; max_temp_c_snapshot: number; within_limits: boolean; corrective_action: string | null; notes: string | null; temperature_equipment?: { name: string } | null };
const fieldClass = 'w-full rounded-xl border border-white/10 bg-[#11161a] px-4 py-3 font-bold text-white outline-none focus:border-cyan-400';
function errorMessage(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }

export default function TemperaturasPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [equipmentId, setEquipmentId] = useState('');
  const [temperature, setTemperature] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [notes, setNotes] = useState('');
  const [name, setName] = useState('Cámara de fresco');
  const [type, setType] = useState<Equipment['equipment_type']>('fresh_room');
  const [minTemp, setMinTemp] = useState('0');
  const [maxTemp, setMaxTemp] = useState('4');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selected = useMemo(() => equipment.find((item) => item.id === equipmentId), [equipment, equipmentId]);
  const numericTemperature = Number(temperature.replace(',', '.'));
  const outside = selected && Number.isFinite(numericTemperature) && (numericTemperature < Number(selected.min_temp_c) || numericTemperature > Number(selected.max_temp_c));

  async function token() { const { data } = await supabase.auth.getSession(); return data.session?.access_token || ''; }
  async function request(body?: object) {
    const accessToken = await token();
    if (!accessToken) throw new Error('Inicia sesión para usar el control de temperaturas.');
    const response = await fetch('/api/temperatures', body ? { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}` } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo completar la operación.');
    return payload;
  }
  async function load() {
    setLoading(true); setError('');
    try { const payload = await request(); setEquipment(payload.equipment || []); setReadings(payload.readings || []); if (!equipmentId && payload.equipment?.[0]) setEquipmentId(payload.equipment[0].id); }
    catch (error: unknown) { setError(errorMessage(error, 'No se pudo cargar.')); }
    finally { setLoading(false); }
  }
  // La carga inicial sincroniza esta pantalla con el registro remoto.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);

  async function addEquipment() {
    setSaving(true); setError(''); setMessage('');
    try { await request({ action: 'add_equipment', name, equipmentType: type, minTempC: Number(minTemp.replace(',', '.')), maxTempC: Number(maxTemp.replace(',', '.')) }); setMessage('Equipo añadido correctamente.'); await load(); }
    catch (error: unknown) { setError(errorMessage(error, 'No se pudo añadir el equipo.')); }
    finally { setSaving(false); }
  }
  async function addReading() {
    setSaving(true); setError(''); setMessage('');
    try { const payload = await request({ action: 'add_reading', equipmentId, temperatureC: numericTemperature, correctiveAction, notes }); setMessage(payload.reading.within_limits ? 'Temperatura registrada: equipo dentro de rango.' : 'Desviación registrada junto con su medida correctora.'); setTemperature(''); setCorrectiveAction(''); setNotes(''); await load(); }
    catch (error: unknown) { setError(errorMessage(error, 'No se pudo guardar la lectura.')); }
    finally { setSaving(false); }
  }

  return <div className="min-h-screen bg-[#080b0d] text-white">
    <header className="border-b border-white/10 bg-[#0c1013]/95 px-5 py-4"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-400">CA46 · APPCC</p><h1 className="mt-1 text-2xl font-black">Control de temperaturas</h1></div><Link href="/cocina" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300">← Cocina</Link></div></header>
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <section className="rounded-[2rem] border border-cyan-400/20 bg-cyan-500/[.06] p-6 sm:p-8"><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Cámaras y congeladores</p><h2 className="mt-2 text-3xl font-black">Registra, detecta y corrige</h2><p className="mt-3 text-sm leading-6 text-slate-400">Cada lectura queda fechada y vinculada a tu empresa. Si sale del rango configurado, CA46 obliga a registrar una medida correctora.</p></section>
      {error && <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/[.07] px-5 py-4 font-bold text-rose-300">{error}</div>}{message && <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/[.07] px-5 py-4 font-bold text-emerald-300">{message}</div>}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-7"><h2 className="text-2xl font-black">Nueva lectura</h2>{loading ? <p className="mt-5 text-slate-500">Cargando…</p> : equipment.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-white/10 p-5 text-sm font-bold text-slate-500">Añade primero una cámara o un congelador.</p> : <div className="mt-5 space-y-4"><label><Label>Equipo</Label><select className={fieldClass} value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>{equipment.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.min_temp_c} a {item.max_temp_c} °C</option>)}</select></label><label><Label>Temperatura medida (°C)</Label><input className={fieldClass} inputMode="decimal" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="Ej.: 2,8" /></label>{outside ? <div className="rounded-xl border border-rose-400/25 bg-rose-500/[.08] p-4"><p className="font-black text-rose-300">⚠ Fuera del rango permitido</p><label className="mt-3 block"><Label>Medida correctora obligatoria</Label><textarea className={`${fieldClass} min-h-24`} value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} placeholder="Ej.: revisar puerta, trasladar producto y avisar al técnico" /></label></div> : null}<label><Label>Observaciones</Label><textarea className={`${fieldClass} min-h-20`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" /></label><button disabled={saving || !temperature} onClick={() => void addReading()} className="w-full rounded-xl bg-cyan-400 px-5 py-4 text-lg font-black text-black disabled:opacity-40">Guardar lectura</button></div>}</section>
        <section className="rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-7"><h2 className="text-2xl font-black">Añadir equipo</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><Label>Nombre</Label><input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} /></label><label><Label>Tipo</Label><select className={fieldClass} value={type} onChange={(e) => { const next = e.target.value as Equipment['equipment_type']; setType(next); if (next === 'freezer') { setMinTemp('-30'); setMaxTemp('-18'); setName('Congelador'); } else if (next === 'fresh_room') { setMinTemp('0'); setMaxTemp('4'); setName('Cámara de fresco'); } }}><option value="fresh_room">Cámara de fresco</option><option value="freezer">Congelador</option><option value="other">Otro equipo</option></select></label><label><Label>Rango permitido</Label><div className="grid grid-cols-2 gap-2"><input className={fieldClass} value={minTemp} onChange={(e) => setMinTemp(e.target.value)} placeholder="Mín."/><input className={fieldClass} value={maxTemp} onChange={(e) => setMaxTemp(e.target.value)} placeholder="Máx."/></div></label><button disabled={saving || !name} onClick={() => void addEquipment()} className="sm:col-span-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-5 py-4 font-black text-cyan-200 disabled:opacity-40">+ Añadir equipo</button></div></section>
      </div>
      <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#0d1215] p-5 sm:p-7"><div className="flex items-center justify-between"><h2 className="text-2xl font-black">Últimos controles</h2><button onClick={() => void load()} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-black">Actualizar</button></div><div className="mt-5 space-y-3">{readings.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-600">Todavía no hay lecturas.</p> : readings.map((row) => <div key={row.id} className={`rounded-xl border p-4 ${row.within_limits ? 'border-emerald-400/15 bg-emerald-400/[.04]' : 'border-rose-400/20 bg-rose-400/[.05]'}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-black">{row.temperature_equipment?.name || 'Equipo'}</p><p className="mt-1 text-xs font-bold text-slate-500">{new Date(row.measured_at).toLocaleString('es-ES')} · rango {row.min_temp_c_snapshot} a {row.max_temp_c_snapshot} °C</p></div><p className={`text-2xl font-black ${row.within_limits ? 'text-emerald-300' : 'text-rose-300'}`}>{row.temperature_c} °C</p></div>{row.corrective_action ? <p className="mt-3 text-sm font-bold text-rose-200">Medida correctora: {row.corrective_action}</p> : null}</div>)}</div></section>
    </main>
  </div>;
}

function Label({ children }: { children: React.ReactNode }) { return <span className="mb-2 block text-[11px] font-black uppercase tracking-[.14em] text-slate-500">{children}</span>; }
