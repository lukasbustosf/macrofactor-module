# API — Endpoints del módulo

## 1. Edge Function `compute_weekly` (Supabase Deno)

Recomputa TDEE y meta semanal. Desplegada y con pg_cron activo.

### Request
```http
POST /functions/v1/compute_weekly
Authorization: Bearer <service_role>   # el secret nativo de Supabase lo provee
Content-Type: application/json

{ "userId": "uuid" }      # un usuario
{ "all": true }           # todos los usuarios (modo cron semanal)
```

### Lógica (`supabase/functions/compute_weekly/index.ts`)
1. Lee `registros_diarios` de los últimos 14 días del usuario.
2. Lee `perfiles.deficit_objetivo`.
3. `weeklyRecompute(logs, deficit)` → `{ tdee, metaDiaria, deltaPesoKg, ... }`.
4. `update perfiles.tdee_actual`.
5. `upsert checkins` (onConflict `user_id,week_start`).

### Response (éxito)
```json
{ "ok": true, "tdee": 2480, "metaDiaria": 2108, "deltaPesoKg": -0.3, ... }
```
Modo `{all:true}`:
```json
{ "ok": true, "processed": 1, "results": [ { "userId": "...", "skip": "sin registros" } ] }
```

### Cron (pg_cron)
`supabase/cron.sql` agenda `compute_weekly_all` los **lunes 06:00 UTC**:
```sql
select cron.schedule('compute_weekly_all','0 6 * * 1',
  $$ select net.http_post(
       url:='https://cqcpkuskimahmifvlckd.supabase.co/functions/v1/compute_weekly',
       body:='{"all": true}'::jsonb); $$);
```

## 2. Backend FastAPI `correlacion` (Railway)

Correlación agua (día D) ↔ peso (día D+1). **Usa el JWT del usuario** (RLS activa).

### `GET /api/correlacion?dias=30`
```http
Authorization: Bearer <JWT_usuario>
```
- `dias`: entero 7–180 (default 30).
- Lee `registros_diarios` del usuario vía `supabase.postgrest.auth(jwt)`.
- Arma pares `(agua_ml[D], peso_kg[D+1])`.
- Calcula Pearson r, p-value y pendiente (kg por litro extra).

#### Response
```json
{
  "n": 21,
  "r": -0.99,
  "p_value": 0.0,
  "slope_kg_por_litro": -0.42,
  "interpretacion": "positivo",
  "detalle": "Mas agua hoy tiende a BAJAR el peso de manana (r=-0.99, -0.42 kg por litro extra). Hidratacion ayuda a bajar la retencion."
}
```
`interpretacion` ∈ `positivo` | `retencion` | `inconcluso` | `insuficiente`.

- `positivo`: más agua hoy → menos peso mañana (r<0, p≤0.05).
- `retencion`: más agua hoy → más peso mañana (r>0) — retención temporal, no grasa.
- `inconcluso`: |r|<0.3 o p>0.05.
- `insuficiente`: n<3.

### `GET /health`
```json
{ "ok": true }
```

### Errores
- `401` si falta el bearer.
- `400` si no hay datos suficientes para armar pares.
- `500` si faltan `SUPABASE_URL` / `SUPABASE_ANON_KEY`.

### Variables de entorno (Railway)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (NO service_role — se usa el JWT del usuario)
- `PORT` (lo da Railway)

## 3. Cliente Supabase (frontend)
El frontend no expone API propia aparte de la UI. Usa directamente:
- `supabase.auth` (signInWithPassword / signUp / getSession / signOut).
- `supabase.from("perfiles" | "registros_diarios")` con RLS.
- `lib/coach.ts` para la meta diaria en cliente.
- Llama al backend con `fetch(NEXT_PUBLIC_BACKEND_URL + "/api/correlacion", { headers: { Authorization: Bearer <jwt> } })`.
