'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ConfiguracionTienda, Producto, UnidadMedida } from '@/lib/types';

const SECCIONES_FIJAS = [
  'Por kilos',
  'Frescos',
  'Mariscos vivos',
  'Elaborados',
  'Recien cocidos',
  'Congelados',
] as const;

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [seccionSeleccionada, setSeccionSeleccionada] = useState('Por kilos');
  const [otraSeccion, setOtraSeccion] = useState('');
  const [permitePreparacion, setPermitePreparacion] = useState(true);
  const [unidadMedida, setUnidadMedida] = useState<UnidadMedida>('kg');

  useEffect(() => {
    const auth = localStorage.getItem('ca46_admin_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '1958') {
      setIsAuthenticated(true);
      localStorage.setItem('ca46_admin_auth', 'true');
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('ca46_admin_auth');
  };

  useEffect(() => {
    async function fetchStatus() {
      const { data } = await supabase
        .from('configuracion')
        .select('tienda_abierta')
        .eq('id', 1)
        .single<ConfiguracionTienda>();

      if (data) setIsOpen(data.tienda_abierta);
      setLoading(false);
    }

    fetchStatus();
  }, []);

  useEffect(() => {
    async function fetchProductos() {
      const { data } = await supabase
        .from('productos')
        .select('*')
        .order('seccion')
        .order('nombre')
        .returns<Producto[]>();

      if (data) setProductos(data);
    }

    fetchProductos();
  }, []);

  const toggleShop = async () => {
    const nextStatus = !isOpen;
    setIsOpen(nextStatus);

    const { error } = await supabase
      .from('configuracion')
      .update({ tienda_abierta: nextStatus, ultima_actualizacion: new Date().toISOString() })
      .eq('id', 1);

    if (error) {
      alert(`Error al actualizar el estado: ${error.message}`);
      setIsOpen(!nextStatus);
    }
  };

  const addProducto = async () => {
    if (!nuevoNombre || !nuevoPrecio) return;

    const seccionFinal = seccionSeleccionada === 'Otros' ? otraSeccion : seccionSeleccionada;
    if (!seccionFinal) {
      alert('Indica una seccion');
      return;
    }

    let { data, error } = await supabase
      .from('productos')
      .insert([
        {
          nombre: nuevoNombre,
          precio_kilo: parseFloat(nuevoPrecio),
          seccion: seccionFinal,
          permite_preparacion: permitePreparacion,
          unidad_medida: unidadMedida,
        },
      ])
      .select()
      .returns<Producto[]>();

    if (
      error &&
      (error.code === '42703' ||
        error.message.includes('permite_preparacion') ||
        error.message.includes('unidad_medida'))
    ) {
      const fallback = await supabase
        .from('productos')
        .insert([
          {
            nombre: nuevoNombre,
            precio_kilo: parseFloat(nuevoPrecio),
            seccion: seccionFinal,
          },
        ])
        .select()
        .returns<Producto[]>();

      data = fallback.data;
      error = fallback.error;

      if (data) {
        alert(
          'El producto se ha creado, pero no se guardaron las opciones de piezas o preparacion porque faltan columnas en Supabase.'
        );
      }
    }

    if (data?.[0]) {
      setProductos((current) => [...current, data[0]]);
      setNuevoNombre('');
      setNuevoPrecio('');
      setOtraSeccion('');
      setPermitePreparacion(true);
      setUnidadMedida('kg');
      return;
    }

    if (error) {
      alert(`Error critico: ${error.message}`);
    }
  };

  const toggleUnidad = async (id: number, currentUnidad: UnidadMedida | null) => {
    const nextUnidad: UnidadMedida = currentUnidad === 'pieza' ? 'kg' : 'pieza';

    const { error } = await supabase
      .from('productos')
      .update({ unidad_medida: nextUnidad })
      .eq('id', id);

    if (error) {
      alert('No se pudo cambiar la unidad. Asegurate de tener la columna "unidad_medida" en Supabase.');
      return;
    }

    setProductos((current) =>
      current.map((producto) =>
        producto.id === id ? { ...producto, unidad_medida: nextUnidad } : producto
      )
    );
  };

  const togglePreparacion = async (id: number, currentStatus: boolean | null) => {
    const nextStatus = !currentStatus;

    const { error } = await supabase
      .from('productos')
      .update({ permite_preparacion: nextStatus })
      .eq('id', id);

    if (error) {
      alert(
        'No se pudo cambiar la preparacion. Asegurate de tener la columna "permite_preparacion" en Supabase.'
      );
      return;
    }

    setProductos((current) =>
      current.map((producto) =>
        producto.id === id ? { ...producto, permite_preparacion: nextStatus } : producto
      )
    );
  };

  const toggleProducto = async (id: number, currentStatus: boolean) => {
    const nextStatus = !currentStatus;

    const { error } = await supabase
      .from('productos')
      .update({ disponible: nextStatus })
      .eq('id', id);

    if (error) return;

    setProductos((current) =>
      current.map((producto) =>
        producto.id === id ? { ...producto, disponible: nextStatus } : producto
      )
    );
  };

  const deleteProducto = async (id: number) => {
    if (!confirm('Estas seguro de eliminar este producto para siempre?')) return;

    const { error } = await supabase.from('productos').delete().eq('id', id);
    if (error) return;

    setProductos((current) => current.filter((producto) => producto.id !== id));
  };

  const updatePrecio = async (id: number, nuevoValor: string) => {
    const precio = parseFloat(nuevoValor);
    if (Number.isNaN(precio)) return;

    const { error } = await supabase
      .from('productos')
      .update({ precio_kilo: precio })
      .eq('id', id);

    if (error) {
      alert(`Error al actualizar el precio: ${error.message}`);
      return;
    }

    setProductos((current) =>
      current.map((producto) =>
        producto.id === id ? { ...producto, precio_kilo: precio } : producto
      )
    );
  };

  const productosPorSeccion = Object.entries(
    productos.reduce<Record<string, Producto[]>>((acc, producto) => {
      const seccion = producto.seccion || 'Sin seccion';
      if (!acc[seccion]) acc[seccion] = [];
      acc[seccion].push(producto);
      return acc;
    }, {})
  ).sort(([a], [b]) => {
    const order = [...SECCIONES_FIJAS, 'Otros'];
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);

    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md space-y-8 rounded-[3rem] border border-slate-800 bg-slate-900/50 p-12 text-center shadow-2xl backdrop-blur-xl"
        >
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">Panel Control</h1>
            <p className="mt-2 font-bold text-slate-500">Introduce la contraseña de acceso</p>
          </div>
          <div className="space-y-4">
            <input
              type="password"
              placeholder="Contraseña..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full rounded-2xl border-2 bg-slate-800 p-5 text-center text-2xl font-black tracking-[0.5em] text-white transition-all focus:outline-none ${
                loginError ? 'border-rose-500 bg-rose-500/10' : 'border-transparent focus:border-indigo-500'
              }`}
              autoFocus
            />
            {loginError && (
              <p className="text-sm font-bold text-rose-500 animate-pulse">Contraseña incorrecta</p>
            )}
          </div>
          <button
            type="submit"
            className="w-full rounded-2xl bg-indigo-600 p-5 text-xl font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-95"
          >
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 md:p-12">
      <header className="mx-auto mb-10 max-w-4xl flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-4xl font-bold text-slate-900">Control Fito</h1>
          <p className="text-lg text-slate-500">Gestion centralizada de Pescaderia R. Vicente</p>
        </div>
        <button 
          onClick={logout}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-400 hover:bg-slate-50 hover:text-rose-500 transition-all"
        >
          Cerrar sesión
        </button>
      </header>

      <main className="mx-auto grid max-w-4xl gap-8">
        <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-800">Estado de la tienda</h2>
              <p className="text-slate-500">Activa o desactiva la recepcion de pedidos</p>
            </div>
            {loading ? (
              <div className="h-14 w-48 animate-pulse rounded-2xl bg-slate-200" />
            ) : (
              <button
                onClick={toggleShop}
                className={`rounded-2xl px-8 py-4 text-lg font-bold transition-all ${
                  isOpen
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-600'
                    : 'bg-rose-500 text-white shadow-lg shadow-rose-200 hover:bg-rose-600'
                }`}
              >
                {isOpen ? 'TIENDA ABIERTA' : 'TIENDA CERRADA'}
              </button>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm transition-all hover:shadow-md">
          <h2 className="mb-6 text-2xl font-semibold text-slate-800">Catalogo de pescados</h2>

          <div className="mb-8 grid grid-cols-1 gap-4 rounded-2xl bg-slate-50 p-6 md:grid-cols-2 lg:grid-cols-4">
            <input
              type="text"
              placeholder="Nombre (ej: Merluza)"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              className="rounded-xl border-slate-200 p-3"
            />
            <input
              type="number"
              placeholder="Precio EUR/kg"
              value={nuevoPrecio}
              onChange={(e) => setNuevoPrecio(e.target.value)}
              className="rounded-xl border-slate-200 p-3"
            />
            <div className="flex flex-col gap-2">
              <select
                value={seccionSeleccionada}
                onChange={(e) => setSeccionSeleccionada(e.target.value)}
                className="rounded-xl border-slate-200 bg-white p-3"
              >
                {SECCIONES_FIJAS.map((seccion) => (
                  <option key={seccion} value={seccion}>
                    {seccion}
                  </option>
                ))}
                <option value="Otros">-- Otros (nueva seccion) --</option>
              </select>
              {seccionSeleccionada === 'Otros' && (
                <input
                  type="text"
                  placeholder="Escribe la seccion..."
                  value={otraSeccion}
                  onChange={(e) => setOtraSeccion(e.target.value)}
                  className="rounded-xl border-indigo-300 bg-indigo-50 p-3"
                />
              )}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
              <input
                type="checkbox"
                id="prep"
                checked={permitePreparacion}
                onChange={(e) => setPermitePreparacion(e.target.checked)}
                className="h-5 w-5 accent-indigo-600"
              />
              <label htmlFor="prep" className="text-sm font-medium text-slate-600">
                Permitir preparacion personalizada
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setUnidadMedida('kg')}
                className={`flex-1 rounded-xl border-2 p-3 font-bold transition-all ${
                  unidadMedida === 'kg'
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg'
                    : 'border-slate-100 bg-white text-slate-400'
                }`}
              >
                Venta por kilos
              </button>
              <button
                onClick={() => setUnidadMedida('pieza')}
                className={`flex-1 rounded-xl border-2 p-3 font-bold transition-all ${
                  unidadMedida === 'pieza'
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg'
                    : 'border-slate-100 bg-white text-slate-400'
                }`}
              >
                Venta por piezas
              </button>
            </div>
            <button
              onClick={addProducto}
              className="h-fit self-start rounded-xl bg-indigo-600 p-3 font-bold text-white hover:bg-indigo-700"
            >
              + Anadir producto
            </button>
          </div>

          <div className="space-y-8">
            {productosPorSeccion.map(([seccion, items]) => (
              <div key={seccion} className="space-y-3">
                <h3 className="px-2 text-sm font-black uppercase tracking-widest text-slate-400">
                  {seccion}
                </h3>
                <div className="grid gap-3">
                  {items.map((producto) => (
                    <div
                      key={producto.id}
                      className={`flex items-center justify-between rounded-2xl border p-4 transition-all ${
                        producto.disponible
                          ? 'border-slate-100 bg-white shadow-sm'
                          : 'border-transparent bg-slate-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`h-3 w-3 rounded-full ${
                            producto.disponible ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                        <div>
                          <span
                            className={`font-bold ${
                              producto.disponible
                                ? 'text-slate-800'
                                : 'text-slate-500 line-through'
                            }`}
                          >
                            {producto.nombre}
                          </span>
                          <div className="group ml-4 inline-flex items-center rounded-xl border border-transparent bg-indigo-50/50 p-1 px-2 transition-all hover:border-indigo-100">
                            <input
                              type="number"
                              step="0.01"
                              defaultValue={producto.precio_kilo}
                              onBlur={(e) => updatePrecio(producto.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  updatePrecio(producto.id, (e.target as HTMLInputElement).value);
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="w-16 bg-transparent p-1 text-sm font-mono text-indigo-600 focus:outline-none"
                            />
                            <span className="mr-2 text-xs font-mono text-indigo-400">EUR/kg</span>
                            <button
                              onClick={(e) => {
                                const input = e.currentTarget.parentElement?.querySelector('input');
                                if (input instanceof HTMLInputElement) {
                                  updatePrecio(producto.id, input.value);
                                }
                              }}
                              className="rounded-lg bg-indigo-600 p-1.5 text-white shadow-sm transition-colors hover:bg-indigo-700"
                              title="Guardar precio"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                width="14"
                                height="14"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleUnidad(producto.id, producto.unidad_medida)}
                          className={`rounded-xl border-2 px-3 py-2 text-[10px] font-black transition-all ${
                            producto.unidad_medida === 'pieza'
                              ? 'border-blue-200 bg-blue-50 text-blue-600'
                              : 'border-indigo-200 bg-indigo-50 text-indigo-600'
                          }`}
                        >
                          {producto.unidad_medida === 'pieza' ? 'PIEZAS' : 'KILOS'}
                        </button>
                        <button
                          onClick={() => togglePreparacion(producto.id, producto.permite_preparacion)}
                          className={`rounded-xl border-2 px-3 py-2 text-[10px] font-black transition-all ${
                            producto.permite_preparacion
                              ? 'border-amber-200 bg-amber-50 text-amber-600'
                              : 'border-slate-100 bg-slate-50 text-slate-400 opacity-40'
                          }`}
                          title="Permitir instrucciones de limpieza o corte"
                        >
                          PREPARACION
                        </button>
                        <button
                          onClick={() => toggleProducto(producto.id, producto.disponible)}
                          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                            producto.disponible
                              ? 'bg-rose-100 text-rose-600 hover:bg-rose-200'
                              : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                          }`}
                        >
                          {producto.disponible ? 'AGOTAR' : 'ACTIVAR'}
                        </button>
                        <button
                          onClick={() => deleteProducto(producto.id)}
                          className="p-2 text-slate-300 hover:text-rose-500"
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {productos.length === 0 && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center italic text-slate-400">
                No hay productos en el catalogo.
              </div>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <button className="rounded-3xl bg-slate-900 p-6 text-xl font-bold text-white transition-all hover:bg-black">
            RESET DEL DIA
          </button>
          <button className="rounded-3xl border border-slate-200 bg-white p-6 text-xl font-bold text-slate-600 transition-all hover:bg-slate-50">
            HISTORIAL DE PEDIDOS
          </button>
        </section>
      </main>
    </div>
  );
}
