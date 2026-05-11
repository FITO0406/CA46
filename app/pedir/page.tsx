'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  CarritoItem,
  ConfiguracionTienda,
  PendingItem,
  Producto,
  TipoEntrega,
} from '@/lib/types';

const ORDEN_SECCIONES = [
  'Por kilos',
  'Frescos',
  'Mariscos vivos',
  'Elaborados',
  'Recien cocidos',
  'Congelados',
] as const;

export default function PedirPage() {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);
  const [tiendaAbierta, setTiendaAbierta] = useState(true);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>('recoger');
  const [direccion, setDireccion] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingItem, setPendingItem] = useState<PendingItem | null>(null);
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [tempPrep, setTempPrep] = useState<Record<number, string>>({});
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchTienda = async () => {
      const { data } = await supabase
        .from('configuracion')
        .select('tienda_abierta')
        .eq('id', 1)
        .single<ConfiguracionTienda>();

      if (data) setTiendaAbierta(data.tienda_abierta);
    };

    const fetchProductos = async () => {
      const { data } = await supabase
        .from('productos')
        .select('*')
        .eq('disponible', true)
        .returns<Producto[]>();

      if (data) setProductos(data);
    };

    fetchTienda();
    fetchProductos();

    const configChannel = supabase
      .channel('config-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'configuracion' },
        (payload) => {
          setTiendaAbierta(Boolean(payload.new.tienda_abierta));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(configChannel);
    };
  }, []);

  const totalCarrito = carrito.reduce((acc, item) => acc + item.precio_kilo * item.cantidad, 0);
  const faltaParaMinimo = tipoEntrega === 'domicilio' ? Math.max(0, 30 - totalCarrito) : 0;
  const puedePedir =
    nombre.trim().length > 0 &&
    telefono.trim().length >= 9 &&
    aceptaPrivacidad &&
    (tipoEntrega === 'recoger' ||
      (tipoEntrega === 'domicilio' && totalCarrito >= 30 && direccion.trim().length > 0));

  const agregarAlCarrito = (
    producto: Producto,
    cantidad: number | string,
    instruccion?: string,
    textoManual?: string
  ) => {
    const yaEsta = carrito.find((item) => item.id === producto.id);

    if (yaEsta && !showConfirmModal) {
      setPendingItem({
        producto,
        cantidad,
        instruccion: instruccion || '',
        textoManual: textoManual || '',
      });
      setShowConfirmModal(true);
      return;
    }

    const cantidadNumerica = typeof cantidad === 'number' ? cantidad : 1;

    setCarrito((current) => [
      ...current,
      {
        ...producto,
        cantidad: cantidadNumerica,
        cantidadTexto: textoManual || (typeof cantidad === 'number' ? `${cantidad}kg` : ''),
        preparacion: instruccion || '',
      },
    ]);

    setShowConfirmModal(false);
    setPendingItem(null);
  };

  const enviarPedido = async () => {
    if (!puedePedir || !nombre.trim()) return;

    setEnviando(true);

    const contenidoTexto = carrito
      .map((item) => {
        const prep = item.preparacion ? ` [PREP: ${item.preparacion}]` : '';
        return `${item.nombre} (${item.cantidadTexto || `${item.cantidad}kg`})${prep}`;
      })
      .join(', ');

    const { error } = await supabase.from('pedidos').insert([
      {
        nombre_cliente: `${nombre.trim()} (Tel: ${telefono.trim()})`,
        contenido: contenidoTexto,
        estado: 'pendiente',
        tipo_entrega: tipoEntrega,
        direccion: tipoEntrega === 'domicilio' ? direccion.trim() : null,
      },
    ]);

    if (!error) {
      alert('Pedido enviado con exito');
      window.location.reload();
    }

    setEnviando(false);
  };

  const productosFiltrados = productos.filter(
    (producto) =>
      producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      producto.seccion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const productosPorSeccion = Object.entries(
    productosFiltrados.reduce<Record<string, Producto[]>>((acc, producto) => {
      const seccion = producto.seccion || 'Por kilos';
      if (!acc[seccion]) acc[seccion] = [];
      acc[seccion].push(producto);
      return acc;
    }, {})
  ).sort(([a], [b]) => {
    const idxA = ORDEN_SECCIONES.indexOf(a as (typeof ORDEN_SECCIONES)[number]);
    const idxB = ORDEN_SECCIONES.indexOf(b as (typeof ORDEN_SECCIONES)[number]);

    if (idxA === -1 && idxB === -1) return a.localeCompare(b);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });

  if (!tiendaAbierta) {
    return (
      <div className="min-h-screen bg-[#ece5dd] p-6 text-center">
        <div className="mx-auto flex min-h-screen max-w-sm items-center justify-center">
          <div className="rounded-3xl bg-white p-8 shadow-xl">
            <div className="mb-4 text-6xl">CERRADO</div>
            <h1 className="mb-2 text-2xl font-bold text-slate-800">Pescaderia cerrada</h1>
            <p className="text-slate-500">
              Lo sentimos, la tienda no esta aceptando pedidos en este momento.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#ece5dd] pb-20 text-slate-900">
      <header className="sticky top-0 z-50 bg-[#075e54] p-4 text-white shadow-lg">
        <h1 className="text-xl font-bold">Pescaderia R. Vicente</h1>
        <p className="text-xs opacity-80">Asistente de pedidos realtime</p>
      </header>

      <main className="mx-auto flex max-w-xl flex-1 flex-col space-y-6 p-4">
        <section className="space-y-4 rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#075e54]">¿Quién eres y cómo te avisamos?</h2>
          
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Tu nombre completo..."
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-2xl border-none bg-slate-50 p-4 focus:ring-2 focus:ring-[#075e54]"
            />
            
            <input
              type="tel"
              placeholder="Tu número de teléfono (Obligatorio)..."
              value={telefono}
              onChange={(e) => setTelefono(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full rounded-2xl border-none bg-slate-50 p-4 focus:ring-2 focus:ring-[#075e54]"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setTipoEntrega('recoger')}
              className={`flex-1 rounded-2xl p-4 font-bold transition-all ${
                tipoEntrega === 'recoger'
                  ? 'bg-[#075e54] text-white shadow-md'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              Recogida
            </button>
            <button
              onClick={() => setTipoEntrega('domicilio')}
              className={`flex-1 rounded-2xl p-4 font-bold transition-all ${
                tipoEntrega === 'domicilio'
                  ? 'bg-[#075e54] text-white shadow-md'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              A domicilio
            </button>
          </div>

          {tipoEntrega === 'domicilio' && (
            <input
              type="text"
              placeholder="Dirección completa para el envío..."
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="w-full rounded-2xl border-none bg-rose-50 p-4 focus:ring-2 focus:ring-rose-500"
            />
          )}

          <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <input
              type="checkbox"
              id="privacidad"
              checked={aceptaPrivacidad}
              onChange={(e) => setAceptaPrivacidad(e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-slate-300 text-[#075e54] focus:ring-[#075e54]"
            />
            <label htmlFor="privacidad" className="text-xs text-slate-500 leading-snug">
              Acepto que mis datos (nombre y teléfono) se usen exclusivamente para gestionar este pedido. 
              <strong> No se guardarán ni usarán para ningún otro fin.</strong>
            </label>
          </div>
        </section>

        {carrito.length > 0 && (
          <section className="space-y-4 rounded-3xl border-2 border-[#075e54] bg-white p-6 shadow-xl">
            <h2 className="border-b pb-2 text-lg font-bold text-[#075e54]">Tu lista de compra:</h2>
            <div className="max-h-60 overflow-y-auto space-y-4 pr-2">
              {carrito.map((item, index) => (
                <div
                  key={`${item.id}-${index}`}
                  className="flex items-center justify-between border-b border-slate-50 py-2 last:border-0"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800">
                      • {item.nombre}{' '}
                      <span className="font-normal text-slate-400">
                        ({item.cantidadTexto || `${item.cantidad}kg`})
                      </span>
                    </span>
                    {item.preparacion && (
                      <span className="mt-1 w-fit rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                        {item.preparacion}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      setCarrito((current) => current.filter((_, itemIndex) => itemIndex !== index))
                    }
                    className="p-1 text-xs font-bold text-rose-500 hover:text-rose-700"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>

            {tipoEntrega === 'domicilio' && faltaParaMinimo > 0 ? (
              <div className="rounded-2xl bg-rose-50 p-4 text-center text-sm font-bold text-rose-600">
                Añade {faltaParaMinimo.toFixed(2)}€ más para el envío gratuito.
              </div>
            ) : tipoEntrega === 'domicilio' ? (
              <div className="rounded-2xl bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-600">
                ¡Pedido mínimo alcanzado!
              </div>
            ) : null}

            <p className="text-center text-[10px] italic text-slate-400">
              * El peso y precio final se confirmarán en el mostrador.
            </p>
          </section>
        )}

        {nombre && (
          <div className="space-y-6">
            <div className="group relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <svg
                  className="h-5 w-5 text-slate-400 transition-colors group-focus-within:text-[#075e54]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Busca tu pescado favorito..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-2xl border-none bg-white py-5 pl-12 pr-4 text-lg text-slate-700 shadow-md transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-[#075e54]"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>


            <div className="space-y-8">
              {productosPorSeccion.map(([seccion, items]) => (
                <div key={seccion} className="space-y-4">
                  <h3 className="ml-1 border-l-4 border-[#075e54] px-2 text-xs font-black uppercase tracking-widest text-slate-400">
                    {seccion}
                  </h3>
                  {items.map((producto) => (
                    <div
                      key={producto.id}
                      className="space-y-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-xl font-bold text-slate-800">{producto.nombre}</span>
                        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-600">
                          {producto.precio_kilo.toFixed(2)} EUR/kg
                        </span>
                      </div>

                      {producto.permite_preparacion !== false && (
                        <div className="mb-4">
                          <div className="mb-2 ml-1 flex items-center gap-2">
                            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-600">
                              1. Como lo preparamos? (opcional)
                            </span>
                          </div>
                          <textarea
                            placeholder="Ej: Limpio, en rodajas, sin espinas..."
                            value={tempPrep[producto.id] || ''}
                            onChange={(e) =>
                              setTempPrep((current) => ({
                                ...current,
                                [producto.id]: e.target.value,
                              }))
                            }
                            rows={2}
                            className="w-full resize-none rounded-2xl border-2 border-transparent bg-slate-50 p-4 text-sm shadow-inner transition-all placeholder:text-slate-300 focus:border-indigo-500 focus:bg-white focus:outline-none"
                          />
                        </div>
                      )}

                      <div className="mb-2 ml-1 flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {producto.permite_preparacion !== false
                            ? '2. Elige la cantidad'
                            : 'Elige la cantidad'}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3].map((cantidad) => (
                          <button
                            key={cantidad}
                            onClick={() => {
                              const cantidadTexto =
                                producto.unidad_medida === 'pieza'
                                  ? `${cantidad} pieza${cantidad > 1 ? 's' : ''}`
                                  : `${cantidad}kg`;

                              agregarAlCarrito(
                                producto,
                                cantidad,
                                tempPrep[producto.id],
                                cantidadTexto
                              );

                              setTempPrep((current) => ({ ...current, [producto.id]: '' }));
                            }}
                            className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs font-bold transition-all hover:bg-[#075e54] hover:text-white hover:shadow-lg"
                          >
                            {producto.unidad_medida === 'pieza'
                              ? `${cantidad} pza.`
                              : `${cantidad} kg`}
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            const unitLabel =
                              producto.unidad_medida === 'pieza' ? 'piezas' : 'kg';
                            const cantidad = prompt(
                              `Cuantas ${unitLabel} quieres? (ej: 3, 5, 2kg, 3 rodajas...)`
                            );

                            if (!cantidad) return;

                            const unitSuffix =
                              producto.unidad_medida === 'pieza' ? 'piezas' : 'kg';
                            const textoFinal = Number.isNaN(Number(cantidad))
                              ? cantidad
                              : `${cantidad} ${unitSuffix}`;

                            agregarAlCarrito(
                              producto,
                              cantidad,
                              tempPrep[producto.id],
                              textoFinal
                            );

                            setTempPrep((current) => ({ ...current, [producto.id]: '' }));
                          }}
                          className="rounded-xl bg-slate-100 p-3 text-xs font-bold transition-all hover:bg-slate-200"
                        >
                          Otra...
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {productos.length > 0 && productosFiltrados.length === 0 && (
                <div className="rounded-3xl bg-white py-10 text-center shadow-sm">
                  <div className="mb-2 text-4xl">SIN RESULTADOS</div>
                  <p className="font-medium text-slate-500">No encontramos "{searchTerm}"</p>
                  <button onClick={() => setSearchTerm('')} className="mt-2 font-bold text-[#075e54]">
                    Ver todos los productos
                  </button>
                </div>
              )}
            </div>
          </div>
        )}


      </main>

      <footer className="fixed bottom-0 left-0 z-[100] w-full border-t border-slate-200 bg-white/80 p-4 backdrop-blur-md">
        <button
          onClick={enviarPedido}
          disabled={!puedePedir || enviando}
          className={`w-full rounded-2xl p-5 text-2xl font-black uppercase tracking-tighter shadow-2xl transition-all ${
            puedePedir ? 'bg-[#075e54] text-white' : 'bg-slate-300 text-slate-500 opacity-50'
          }`}
        >
          {enviando ? 'Enviando...' : 'REALIZAR PEDIDO'}
        </button>
      </footer>

      {showConfirmModal && pendingItem && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[40px] bg-white p-8 shadow-2xl">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-500">
              <svg
                viewBox="0 0 24 24"
                width="40"
                height="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 className="mb-2 text-center text-2xl font-black uppercase leading-tight text-slate-800">
              Cuidado
            </h3>
            <p className="mb-8 text-center font-medium text-slate-500">
              Ya tienes <span className="font-bold text-indigo-600">{pendingItem.producto.nombre}</span>{' '}
              en tu carrito. Seguro que quieres anadir otro igual?
            </p>
            <div className="grid gap-3">
              <button
                onClick={() =>
                  agregarAlCarrito(
                    pendingItem.producto,
                    pendingItem.cantidad,
                    pendingItem.instruccion,
                    pendingItem.textoManual
                  )
                }
                className="w-full rounded-2xl bg-[#075e54] p-5 text-lg font-black text-white shadow-lg shadow-emerald-200 transition-all"
              >
                Si, anadir otro
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingItem(null);
                }}
                className="w-full rounded-2xl bg-slate-100 p-5 text-lg font-black text-slate-500 transition-all"
              >
                No, cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
