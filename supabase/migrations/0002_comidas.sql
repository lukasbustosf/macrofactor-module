-- Fase 3: registro de comidas, menús favoritos.
-- Nota: la tabla 'alimentos' YA existe con esquema legacy
-- (barcode, name, kcal_100g, protein_100g, carbs_100g, fat_100g, updated_at).
-- NO la recreamos; comidas.alimento_ref es text (barcode o nombre) para no romper FK.

-- Log de comidas del día (fuente de verdad del total de kcal)
create table if not exists public.comidas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  fecha date not null default current_date,
  tipo_comida text not null check (tipo_comida in ('desayuno','almuerzo','once','cena','snack')),
  alimento_ref text,
  nombre text not null,
  cantidad_g real default 0,
  kcal real default 0,
  proteina real default 0,
  carbohidrato real default 0,
  grasa real default 0,
  created_at timestamptz default now()
);
create index if not exists comidas_user_fecha_idx on public.comidas(user_id, fecha);

-- Menús / días favoritos
create table if not exists public.menu_favorito (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  nombre text not null,
  created_at timestamptz default now()
);
create table if not exists public.menu_favorito_item (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid references public.menu_favorito(id) on delete cascade not null,
  tipo_comida text not null,
  nombre text not null,
  cantidad_g real default 0,
  kcal real default 0,
  proteina real default 0,
  carbohidrato real default 0,
  grasa real default 0
);

-- RLS
alter table public.comidas enable row level security;
alter table public.menu_favorito enable row level security;
alter table public.menu_favorito_item enable row level security;

drop policy if exists "comidas owner select" on public.comidas;
create policy "comidas owner select" on public.comidas for select using (auth.uid() = user_id);
drop policy if exists "comidas owner insert" on public.comidas;
create policy "comidas owner insert" on public.comidas for insert with check (auth.uid() = user_id);
drop policy if exists "comidas owner delete" on public.comidas;
create policy "comidas owner delete" on public.comidas for delete using (auth.uid() = user_id);

drop policy if exists "menu owner select" on public.menu_favorito;
create policy "menu owner select" on public.menu_favorito for select using (auth.uid() = user_id);
drop policy if exists "menu owner insert" on public.menu_favorito;
create policy "menu owner insert" on public.menu_favorito for insert with check (auth.uid() = user_id);
drop policy if exists "menu owner delete" on public.menu_favorito;
create policy "menu owner delete" on public.menu_favorito for delete using (auth.uid() = user_id);

drop policy if exists "menu_item select via menu" on public.menu_favorito_item;
create policy "menu_item select via menu" on public.menu_favorito_item for select using (
  exists (select 1 from public.menu_favorito m where m.id = menu_id and m.user_id = auth.uid())
);
drop policy if exists "menu_item insert via menu" on public.menu_favorito_item;
create policy "menu_item insert via menu" on public.menu_favorito_item for insert with check (
  exists (select 1 from public.menu_favorito m where m.id = menu_id and m.user_id = auth.uid())
);
drop policy if exists "menu_item delete via menu" on public.menu_favorito_item;
create policy "menu_item delete via menu" on public.menu_favorito_item for delete using (
  exists (select 1 from public.menu_favorito m where m.id = menu_id and m.user_id = auth.uid())
);
