alter table public.kitchen_transformations
  add column if not exists storage_max_temp_c numeric(5,2),
  add column if not exists shelf_life_days integer,
  add column if not exists storage_instructions text;

alter table public.kitchen_transformations
  add constraint kitchen_transformations_storage_max_temp_check check (storage_max_temp_c between -40 and 30),
  add constraint kitchen_transformations_shelf_life_days_check check (shelf_life_days between 1 and 365);

create table public.temperature_equipment (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  equipment_type text not null check (equipment_type in ('fresh_room', 'freezer', 'other')),
  min_temp_c numeric(5,2) not null,
  max_temp_c numeric(5,2) not null,
  is_active boolean not null default true,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint temperature_equipment_range_check check (min_temp_c between -60 and 40 and max_temp_c between -60 and 40 and min_temp_c <= max_temp_c)
);

create table public.temperature_readings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  equipment_id uuid not null references public.temperature_equipment(id) on delete cascade,
  measured_at timestamptz not null default now(),
  temperature_c numeric(5,2) not null check (temperature_c between -80 and 80),
  min_temp_c_snapshot numeric(5,2) not null,
  max_temp_c_snapshot numeric(5,2) not null,
  within_limits boolean not null,
  corrective_action text,
  notes text,
  recorded_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint temperature_readings_corrective_action_check check (within_limits or nullif(btrim(corrective_action), '') is not null)
);

create unique index temperature_equipment_company_name_active_unique on public.temperature_equipment(company_id, lower(name)) where is_active;
create index temperature_equipment_company_active_idx on public.temperature_equipment(company_id, is_active, name);
create index temperature_readings_company_measured_idx on public.temperature_readings(company_id, measured_at desc);
create index temperature_readings_equipment_measured_idx on public.temperature_readings(equipment_id, measured_at desc);

alter table public.temperature_equipment enable row level security;
alter table public.temperature_readings enable row level security;
revoke all on table public.temperature_equipment from anon, authenticated;
revoke all on table public.temperature_readings from anon, authenticated;
grant all on table public.temperature_equipment to service_role;
grant all on table public.temperature_readings to service_role;
