# Arquitectura — Módulo de nutrición adaptativa (estilo MacroFactor)

Este doc explica cómo encajan las piezas. Complementa `README.md`,
`docs/MATH.md` (matemática) y `docs/ROADMAP.md` (estado/plan).

## 1. Stack (decisión del usuario — correcto y estable)

| Capa | Proveedor | Rol |
|---|---|---|
| Frontend | **Vercel** | Next.js 14 (App Router) en `web/` |
| Backend API | **Railway** | FastAPI (Python) en `backend/` — correlación agua↔peso |
| Datos + Auth + RLS | **Supabase** | Postgres + Auth + Row Level Security |
| Motor adaptativo | **Supabase Edge Functions** | `compute_weekly` (TS/Deno) — recalcula TDEE/meta |

Conexión a BD: el frontend usa `@supabase/ssr` con la `anon` key + RLS.
El backend FastAPI usa solo `anon` + el **JWT del usuario** (`supabase.postgrest.auth(jwt)`),
así la RLS se aplica y cada usuario solo ve sus datos. **Nunca** se usa
`service_role` en runtime del backend. La Edge Function sí usa `service_role`
(del secret nativo de Supabase) porque debe recalcular para todos los usuarios
en el cron semanal.

## 2. Flujo de datos

```
                 ┌─────────────────────────────────────────────┐
                 │  Navegador (Next.js / Vercel)               │
                 │  - login / signup (Supabase Auth)            │
                 │  - onboarding (altura/objetivo/déficit)      │
                 │  - registro diario: peso, kcal, agua (+500)  │
                 │  - pantalla "Hoy": meta = TDEE*(1-déficit)    │
                 │  - botón "Ver correlación" ─────────────┐    │
                 └───────────────┬──────────────────────────┼────┘
                                 │ anon key + RLS            │ JWT Bearer
                                 ▼                          ▼
                       ┌───────────────────┐      ┌──────────────────────────┐
                       │  Supabase Postgres │      │  Railway FastAPI         │
                       │  perfiles          │      │  /api/correlacion        │
                       │  registros_diarios │      │  (lee via JWT + RLS)     │
                       │  checkins          │      └──────────────────────────┘
                       │  alimentos         │
                       └─────────┬──────────┘
                                 │ pg_cron (lunes 06:00 UTC)
                                 ▼
                       ┌──────────────────────────────────────┐
                       │  Edge Function compute_weekly        │
                       │  lee últimas 2 semanas de registros   │
                       │  weeklyRecompute() -> tdee + meta     │
                       │  escribe perfiles.tdee_actual, checkins│
                       └──────────────────────────────────────┘
```

## 3. Componentes y archivos

### 3.1 Motor de referencia (Python) — `src/macrofactor/`
- `models.py` — dataclasses `DailyLog`, `Objective`, `Recommendation`.
- `weight_trend.py` — suavizado de tendencia de peso (media móvil).
- `tdee_estimator.py` — estimación TDEE por balance energético.
- `coach.py` — recomendación de ingesta según objetivo (cut/bulk/maint).
- `weekly_mvp.py` — implementación del algoritmo de 4 pasos.
- `tests/` — `pytest` (6/6).

### 3.2 Producción TS — `supabase/functions/`
- `_shared/nutrition.ts` — `weeklyRecompute()` (algoritmo principal), `recommendByRate()`.
- `_shared/barcode.ts` — escáner Open Food Facts (pendiente deploy/UI).
- `compute_weekly/index.ts` — Edge Function: recalcula TDEE/meta por usuario o `{all:true}`.
- `tests-ts/` — `tsx` (12/12).

### 3.3 Frontend — `web/` (Next.js 14 App Router)
- `app/page.tsx` — pantalla única: auth, onboarding, registro diario, "Hoy", agua, correlación.
- `app/TrendChart.tsx` — gráfico de tendencia (recharts).
- `lib/supabase/client.ts` — cliente `@supabase/ssr`.
- `lib/coach.ts` — port de `coach.py` (meta diaria a partir de TDEE + déficit).
- `.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_BACKEND_URL`.

### 3.4 Backend correlación — `backend/` (FastAPI/Railway)
- `main.py` — `GET /api/correlacion?dias=30` (JWT+RLS), `GET /health`.
- `correlacion.py` — Pearson r, p-value, pendiente (sin scipy; numpy).
- `requirements.txt`, `Procfile`, `railway.json`.

## 4. Identidad de usuarios y RLS
- `auth.users` (Supabase Auth) es la fuente de verdad.
- Trigger `on_auth_user_created` (SECURITY DEFINER) crea la fila en `perfiles`
  con PK = `auth.users.id` al registrarse.
- Todas las tablas tienen RLS; políticas `*_propios` limitan a `auth.uid() = ...`.
- `alimentos` es de lectura pública (caché compartida del escáner).

## 5. Seguridad
- `anon` key: pública por diseño (va en el bundle del frontend).
- `service_role`: solo dentro de la Edge Function (secret nativo de Supabase,
  `SUPABASE_SERVICE_ROLE_KEY`). Jamás en el frontend ni en el backend FastAPI runtime.
- El backend FastAPI autentica cada request con el JWT del usuario → RLS activa.
- Ver `docs/ROADMAP.md` §5 para credenciales que deben rotarse.
