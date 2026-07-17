# MacroFactor Module

Módulo de nutrición adaptativa inspirado en la lógica de
[MacroFactor](https://macrofactorapp.com/): **TDEE dinámico** estimado desde los
datos reales del usuario (no fórmula poblacional), **tendencia de peso
suavizada** y **coaching de ingesta** que se reajusta solo.

## Stack (decisión del usuario — correcto y estable)

| Capa | Proveedor | Rol |
|---|---|---|
| Frontend | **Vercel** | Next.js 14 (App Router) — `web/` |
| Backend API | **Railway** | FastAPI (Python) — `backend/` (correlación agua↔peso) |
| Datos + Auth + RLS | **Supabase** | Postgres + Auth + Row Level Security |
| Motor adaptativo | **Supabase Edge Functions** | `compute_weekly` (TS/Deno) |

## Algoritmo principal (MVP — 4 pasos, promedios semanales)

```
P1. delta_peso = avg(peso_esta_semana) - avg(peso_semana_pasada)
P2. deficit_real_diario = -delta_peso * 7700 / 7
P3. TDEE = avg(calorias_esta_semana) + deficit_real_diario
P4. meta = TDEE * (1 - deficit_objetivo)
```

Derivación completa y validación en `docs/MATH.md`.

## Estructura real

```
src/macrofactor/            # motor Python (referencia + tests)
    models.py, weight_trend.py, tdee_estimator.py, coach.py, weekly_mvp.py
tests/                      # pytest (6/6)
web/                        # frontend Next.js 14 (Vercel)
    app/page.tsx            # auth + onboarding + registro + "Hoy" + agua + correlación
    app/TrendChart.tsx      # gráfico de tendencia
    lib/supabase/client.ts  # cliente @supabase/ssr
    lib/coach.ts            # port de coach.py (meta diaria)
supabase/
    functions/
        _shared/nutrition.ts   # weeklyRecompute (algoritmo principal)
        _shared/barcode.ts     # escáner Open Food Facts (pendiente deploy/UI)
        compute_weekly/        # Edge Function (cron semanal)
    schema.sql, triggers.sql, cron.sql
    tests-ts/               # tests TS (tsx, 12/12)
backend/                    # FastAPI correlación (Railway)
    main.py, correlacion.py, requirements.txt, Procfile, railway.json
docs/
    MATH.md                 # matemática y diseño (investigación)
    ROADMAP.md              # estado verificado + plan por fases
    ARCHITECTURE.md         # flujo de datos y componentes
    SCHEMA.md               # tablas + RLS
    API.md                  # endpoints
    DEPLOY.md               # pasos de despliegue
    DEPLOY_FASE1.md         # despliegue del motor adaptativo
```

## Comandos

```bash
# Python (referencia + tests)
pip install -e .
pytest                      # 6/6

# TypeScript (producción + tests)
cd web && npm install && npm run build
npx tsx supabase/tests-ts/*.test.ts   # 12/12
```

## Despliegue

Ver `docs/DEPLOY.md`. Resumen: Vercel (Root Directory `web`), Railway
(Root Directory `backend`), Edge Function vía Supabase CLI + pg_cron semanal.

## Estado

Fase 1 (motor adaptativo + cron + onboarding + pantalla "Hoy") **completa**.
Siguiente: Fase 2 (diseño/tabs). Ver `docs/ROADMAP.md`.
