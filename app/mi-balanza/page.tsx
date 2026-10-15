'use client';
import {useState} from 'react';

type Lot = {id:string; remaining:number; initial:number; plu:number};
type Notice = {id:number; text:string; open:boolean};
const initial:Lot[]=[{id:'PIJ-001',plu:5,initial:4000,remaining:4000},{id:'PIJ-002',plu:5,initial:3000,remaining:3000}];
export default function MiBalanzaPage(){
 const [lots,setLots]=useState<Lot[]>(initial);
 const [notices,setNotices]=useState<Notice[]>([]);
 const [log,setLog]=useState<string[]>(['Simulación iniciada. Dos lotes ficticios de PIJOTAS · PLU 5']);
 const [grams,setGrams]=useState(1000);
 const [nextId,setNextId]=useState(1);
 const [newName,setNewName]=useState('');
 const [catalog,setCatalog]=useState([{name:'PIJOTAS',plu:5},{name:'PESCADA',plu:1},{name:'BOQUERON',plu:3}]);
 const [selected,setSelected]=useState(5);
 const [lastError,setLastError]=useState('');
 const push=(message:string)=>setLog(v=>[message,...v]);
 const alert=(message:string)=>{
  setNotices(v=>[{id:nextId,text:message,open:true},...v]);
  setNextId(v=>v+1);
  push('REVISIÓN: '+message);
 };
 const sell=()=>{
  setLastError('');
  if(!Number.isSafeInteger(grams)||grams<=0){setLastError('Introduce gramos enteros positivos');return;}
  const current=lots.find(l=>l.plu===selected&&l.remaining>0);
  if(!current||current.remaining<grams){alert('Cantidad no asignable a un único lote. Revisar venta de '+grams+' g');return;}
  setLots(v=>v.map(l=>l.id===current.id?{...l,remaining:l.remaining-grams}:l));
  push('PLU '+selected+' · '+grams+' g · lote '+current.id+' · restante '+(current.remaining-grams)+' g');
 };
 const free=()=>{
  if(!Number.isSafeInteger(grams)||grams<=0){setLastError('Introduce gramos enteros positivos');return;}
  setLastError('');
  alert('Pesada libre '+grams+' g. No se descuenta ningún lote automáticamente');
 };
 const addProduct=()=>{
  const name=newName.trim().toUpperCase();
  if(!name){setLastError('Escribe un producto');return;}
  if(catalog.some(p=>p.name===name)){setLastError('Ese producto ya existe');return;}
  const used=new Set(catalog.map(p=>p.plu));
  let code=1;while(used.has(code))code++;
  setCatalog(v=>[...v,{name,plu:code}]);
  push(name+' · PLU '+code+' RESERVADO EN DEMO. Familia y alta ETPOS pendientes de confirmar');
  setNewName('');setLastError('');
 };
 const resolve=(id:number)=>{setNotices(v=>v.map(n=>n.id===id?{...n,open:false}:n));push('Incidencia '+id+' revisada en simulación')};
 const pending=notices.filter(n=>n.open);
 return <main className="min-h-screen bg-slate-950 text-white p-5 sm:p-9">
  <div className="mx-auto max-w-5xl space-y-6">
   <header className="flex items-start justify-between gap-4"><div><p className="uppercase tracking-widest text-xs text-orange-400 font-bold">CA46 · Mi balanza · Integración en pruebas</p><h1 className="text-3xl font-black mt-2">Mi balanza · prueba virtual</h1><p className="text-slate-300 mt-2">Simulación exclusivamente en este navegador. No envía pedidos, etiquetas ni datos a balanzas reales.</p></div><a href="#avisos" className="rounded-xl border border-orange-400 px-3 py-2 text-sm font-bold" aria-label={'Revisiones pendientes: '+pending.length}>🔔 {pending.length}</a></header>
   <section className="grid sm:grid-cols-3 gap-3">{[{label:'PLU de ejemplo',value:String(selected)},{label:'Lotes activos',value:String(lots.filter(l=>l.remaining>0).length)},{label:'Revisiones pendientes',value:String(pending.length)}].map(x=><div key={x.label} className="rounded-2xl border border-white/20 p-4"><div className="text-slate-400 text-xs">{x.label}</div><div className="text-2xl font-bold">{x.value}</div></div>)}</section>
   <section className="rounded-2xl border border-white/20 p-5 space-y-4"><h2 className="text-xl font-bold">Venta virtual</h2>
    <label className="block text-sm">Artículo / PLU<select value={selected} onChange={e=>setSelected(Number(e.target.value))} className="block w-full mt-1 p-3 rounded-lg bg-slate-800">{catalog.map(p=><option key={p.plu} value={p.plu}>{p.name} · PLU {p.plu}</option>)}</select></label>
    <label className="block text-sm">Cantidad en gramos<input type="number" min="1" step="1" value={grams} onChange={e=>setGrams(Number(e.target.value))} className="block w-full mt-1 p-3 rounded-lg bg-slate-800"/></label>
    <div className="flex flex-wrap gap-3"><button onClick={sell} className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-black">Vender con PLU</button><button onClick={free} className="rounded-xl bg-slate-700 px-5 py-3 font-bold">Pesada libre</button><button onClick={()=>{setLots(initial);setNotices([]);setLog(['Laboratorio reiniciado']);setSelected(5);setNextId(1);setCatalog([{name:'PIJOTAS',plu:5},{name:'PESCADA',plu:1},{name:'BOQUERON',plu:3}]);setLastError('')}} className="rounded-xl border border-white/30 px-5 py-3">Reiniciar</button></div>
    {lastError&&<p role="alert" className="text-red-300">{lastError}</p>}
   </section>
   <section className="rounded-2xl border border-white/20 p-5 space-y-3"><h2 className="text-xl font-bold">Lotes virtuales · Pijotas</h2>{lots.map(l=><div key={l.id} className="flex flex-wrap justify-between gap-2 border-b border-white/10 py-2"><span>{l.id} · PLU {l.plu}</span><span>{(l.remaining/1000).toFixed(3)} / {(l.initial/1000).toFixed(3)} kg {l.remaining===0?'· AGOTADO':''}</span>{l.remaining>0&&<button className="text-orange-300 underline" onClick={()=>{setLots(v=>v.map(x=>x.id===l.id?{...x,remaining:0}:x));push('Cierre manual de '+l.id+' en demo')}}>Cerrar lote</button>}</div>)}</section>
   <section className="rounded-2xl border border-white/20 p-5 space-y-3"><h2 className="text-xl font-bold">Alta simulada de producto</h2><p className="text-sm text-slate-400">Reserva visual ilustrativa. No verifica códigos reales de ETPOS ni crea una familia.</p><div className="flex flex-wrap gap-2"><input aria-label="Nombre producto nuevo" placeholder="Nombre nuevo" value={newName} onChange={e=>setNewName(e.target.value)} className="flex-1 min-w-48 bg-slate-800 rounded-lg p-3"/><button onClick={addProduct} className="bg-orange-500 text-black font-bold rounded-lg px-4">Proponer PLU</button></div></section>
   <section id="avisos" className="rounded-2xl border border-white/20 p-5 space-y-3"><h2 className="text-xl font-bold">🔔 Administración de incidencias ({pending.length})</h2>{notices.map(n=><div key={n.id} className="flex items-center justify-between gap-3 border-b border-white/10 py-2"><p className={n.open?'text-white':'text-slate-500'}>{n.text}{!n.open?' · resuelta':''}</p>{n.open&&<button onClick={()=>resolve(n.id)} className="shrink-0 bg-slate-700 rounded-lg px-3 py-2">Marcar revisada</button>}</div>)}{notices.length===0&&<p className="text-slate-400">Sin incidencias en esta sesión.</p>}</section>
   <section className="rounded-2xl border border-white/20 p-5"><h2 className="text-xl font-bold">Historial de la sesión</h2>{log.map((line,i)=><p key={i} className="text-sm border-b border-white/10 py-2 text-slate-300">{line}</p>)}</section>
  </div>
 </main>;
}
