export type UnidadMedida = 'kg' | 'pieza';
export type TipoEntrega = 'recoger' | 'domicilio';
export type EstadoPedido = 'pendiente' | 'preparando' | 'listo';

export type Producto = {
  id: number;
  nombre: string;
  precio_kilo: number;
  seccion: string | null;
  disponible: boolean;
  permite_preparacion: boolean | null;
  unidad_medida: UnidadMedida | null;
};

export type Pedido = {
  id: number;
  nombre_cliente: string;
  contenido: string;
  estado: EstadoPedido;
  tipo_entrega: TipoEntrega | null;
  direccion: string | null;
  creado_en?: string;
};

export type ConfiguracionTienda = {
  tienda_abierta: boolean;
};

export type CarritoItem = Producto & {
  cantidad: number;
  cantidadTexto: string;
  preparacion: string;
};

export type PendingItem = {
  producto: Producto;
  cantidad: number | string;
  instruccion: string;
  textoManual: string;
};
