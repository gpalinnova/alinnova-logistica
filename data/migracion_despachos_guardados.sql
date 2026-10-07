-- Despachos guardados del wizard de Operaciones de Logística (Panadería /
-- Gastronomía). Un registro = una sesión completa del wizard (snapshot en
-- `estado`) que se puede reabrir para reimprimir o aplicar novedades.
-- No confundir con logistica_despachos (historial de ruteros impresos,
-- una fila por ruta).
-- Aplicada en Supabase el 2026-10-07.

create table public.logistica_despachos_guardados (
  id uuid primary key default gen_random_uuid(),
  linea text not null check (linea in ('panaderia', 'gastronomia')),
  nombre text not null,
  estado jsonb not null,
  novedades jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index logistica_despachos_guardados_updated_idx on public.logistica_despachos_guardados (updated_at desc);
alter table public.logistica_despachos_guardados enable row level security;
create policy logistica_despachos_guardados_all_public on public.logistica_despachos_guardados for all to public using (true) with check (true);
