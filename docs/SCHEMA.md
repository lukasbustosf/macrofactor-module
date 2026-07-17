# Esquema de base de datos — Supabase Postgres

Aplicado con `supabase db query --file supabase/schema.sql --linked`.
Revisado y verificado (tablas + RLS + trigger activos).

## Tablas

### `perfiles`
Configuración del usuario + TDEE estimado actual. **PK = `auth.users.id`**
(no `user_id` — la columna se llama `id` y referencia a `auth.users`).

| columna | tipo | default | nota |
|---|---|---|---|
| `id` | uuid PK | — | = `auth.users.id` (FK a auth.users) |
| `updated_at` | timestamptz | now() | |
| `altura_cm` | int | null | se setea en onboarding |
| `deficit_objetivo` | float | 0.15 | 0.15 = 15% déficit |
| `tdee_actual` | int | 2500 | gasto estimado; lo recalcula `compute_weekly` |
| `objetivo` | text | 'cut' | cut / bulk / maintenance / custom |

### `registros_diarios`
El corazón del algoritmo: **1 fila por día** (`unique(user_id, fecha)`).

| columna | tipo | default | nota |
|---|---|---|---|
| `id` | bigint identity PK | — | |
| `user_id` | uuid FK | — | = `auth.users.id` |
| `fecha` | date | current_date | |
| `peso_kg` | float | null | peso en ayunas |
| `calorias_consumidas` | int | 0 | |
| `proteinas_g` | int | 0 | |
| `carbohidratos_g` | int | 0 | |
| `grasas_g` | int | 0 | |
| `agua_ml` | int | 0 | diferencial del usuario (meta 3000 ml) |

Índice: `registros_diarios_user_fecha (user_id, fecha)`.

### `checkins`
Resultado del recomputo semanal (lo escribe `compute_weekly`).
`unique(user_id, week_start)`.

| columna | tipo | nota |
|---|---|---|
| `id` | bigint identity PK | |
| `user_id` | uuid FK | |
| `week_start` | date | lunes de la semana ISO |
| `estimated_tdee` | numeric | TDEE estimado esa semana |
| `target_intake_kcal` | numeric | meta diaria calculada |
| `delta_peso_kg` | numeric | Δ peso vs semana anterior |
| `promedio_calorias` | numeric | promedio de kcal de la semana |
| `confidence` | numeric | (reservado; hoy null) |

### `alimentos`
Caché local del escáner de código de barras (Open Food Facts). Llave = `barcode`.
`kcal_100g`, `protein_100g`, `carbs_100g`, `fat_100g`, `name`, `updated_at`.

## Row Level Security (RLS)

Todas las tablas tienen RLS activa. Políticas:

- `perfiles_propios` — `using (auth.uid() = id)` / `with check (auth.uid() = id)`.
- `registros_propios` — `using (auth.uid() = user_id)` …
- `checkins_propios` — `using (auth.uid() = user_id)` …
- `alimentos_lectura` — `for select using (true)` (caché compartida de lectura).

## Trigger de signup

`triggers.sql` define `handle_new_user()` (SECURITY DEFINER) que inserta la fila
en `perfiles` al crearse el usuario en `auth.users`. Verificado: un insert en
`auth.users` crea la fila correspondiente en `perfiles`.

## Notas de diseño
- El `compute_weekly` actualiza `perfiles.tdee_actual` y hace `upsert` en
  `checkins` con `onConflict: "user_id,week_start"`.
- El frontend lee `perfiles.tdee_actual` + `deficit_objetivo` para mostrar la
  meta diaria en la pantalla "Hoy" vía `lib/coach.ts`.
