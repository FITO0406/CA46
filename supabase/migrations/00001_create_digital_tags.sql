-- Crear tabla principal
CREATE TABLE digital_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drive_file_id TEXT UNIQUE NOT NULL,
    product_name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('kg', 'unidad', 'manojo')),
    origin TEXT,
    category TEXT NOT NULL DEFAULT 'General',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Índices optimizados para búsquedas de latencia <50ms según el blueprint
CREATE INDEX idx_tags_active_search ON digital_tags (product_name) WHERE is_active = true;
CREATE INDEX idx_tags_lifecycle ON digital_tags (expires_at) WHERE is_active = true;

-- Habilitar Row Level Security (RLS)
ALTER TABLE digital_tags ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad
-- Lectura pública solo para etiquetas activas y que no hayan expirado
CREATE POLICY public_read_active_tags 
ON digital_tags FOR SELECT 
TO anon 
USING (is_active = true AND expires_at > now());

-- Acceso total para administradores autenticados
CREATE POLICY admin_full_access 
ON digital_tags FOR ALL 
TO authenticated 
USING (true);
