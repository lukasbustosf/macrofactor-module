# MacroFactor Module

Módulo de nutrición adaptativa inspirado en la lógica de [MacroFactor](https://macrofactorapp.com/):
**TDEE dinámico** estimado desde los datos reales del usuario (no fórmula poblacional),
**tendencia de peso suavizada** y **coaching de ingesta** que se reajusta solo.

## Decisión de stack (Go 1)
- **TypeScript + Supabase** = producción (Edge Functions, el algoritmo del MVP).
- **Python** = motor de referencia + tests (verifica la lógica TS).

## Algoritmo principal (MVP — 4 pasos, promedios semanales)
```
P1. delta_peso = avg(peso_esta_semana) - avg(peso_semana_pasada)
P2. deficit_real_diario = -delta_peso * 7700 / 7
P3. TDEE = avg(calorias_esta_semana) + deficit_real_diario
P4. meta = TDEE * (1 - deficit_objetivo)
```
Ver `docs/MATH.md` para la derivación completa y validación de ejemplos.

## Estructura
```
src/macrofactor/          # motor Python (referencia + tests)
    models.py, weight_trend.py, tdee_estimator.py, coach.py, weekly_mvp.py
supabase/functions/       # producción TS
    _shared/nutrition.ts  # weeklyRecompute (algoritmo principal)
    _shared/barcode.ts    # escáner Open Food Facts
    compute_weekly/       # Edge Function (cron semanal)
tests-ts/                 # tests TS (tsx)
docs/MATH.md              # documentación matemática y de diseño
```

## Uso rápido
```bash
# Python (referencia)
pip install -e .
pytest

# TypeScript (producción)
npm install
npm test          # corre tests TS (10/10)
npm run typecheck # tsc limpio
```

## Roadmap
- [ ] Unificar esquema SQL (perfiles + registros_diarios).
- [ ] Cablear `compute_weekly` al cliente real de Supabase.
- [ ] Integrar escáner de código de barras en frontend Next.js.
- [ ] Módulo de agua / correlación (diferencial del usuario).
```
