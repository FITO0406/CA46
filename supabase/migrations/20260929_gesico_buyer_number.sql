-- CA46 · Validación de facturas de 72 h por número de comprador GESICO
-- Cada empresa guarda su N.º minorista/comprador y el OCR lo usa para impedir
-- que se publiquen facturas pertenecientes a otra empresa.

begin;

alter table public.company_settings
  add column if not exists gesico_buyer_number text not null default '';

comment on column public.company_settings.gesico_buyer_number is
  'N.º minorista/comprador GESICO usado para validar la titularidad de facturas de 72 horas.';

commit;
