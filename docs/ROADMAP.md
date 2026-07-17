# Roadmap y estado del proyecto — Módulo de nutrición adaptativa (estilo MacroFactor)

> Complementa `docs/MATH.md` (matemática). Este archivo documenta **estado
> real verificado**, **qué falta** y **plan por fases** para decidir prioridades.
> Última actualización: 2026-07-17.

---

## 1. Stack (decisión del usuario — correcto y estable)

| Capa | Proveedor | Rol |
|---|---|---|
| Frontend | **Vercel** | Next.js 14 (App Router, `web/`) |
| Backend API | **Railway** | FastAPI (Python, `backend/`) — correlación agua↔peso |
| Datos + Auth + RLS | **Supabase** | Postgres + Auth + Row Level Security |
| Motor adaptativo | **Supabase Edge Functions** | `compute_weekly` (TS, Deno) — por desplegar |

URLs verificadas (HTTP 200 / `/health` ok):
- Frontend: `https://macrofactor-module-tfcc.vercel.app`
- Backend: `https://insightful-youth-production.up.railway.app`
- Supabase: `cqcpkuskimahmifvlckd.supabase.co`

---

## 2. Estado real (verificado en vivo, no promesas)

| Componente | Estado | Evidencia |
|---|---|---|
| Módulo Python ref (`src/macrofactor/`) | ✅ | pytest 6/6 |
| Port TS (`supabase/functions/_shared/nutrition.ts`) | ✅ | tsx 12/12 |
| BD Supabase: `perfiles`, `registros_diarios`, `checkins`, `alimentos` + RLS | ✅ | apply vía CLI + policies activas |
| Trigger signup → `perfiles` (SECURITY DEFINER) | ✅ | verificado: insert en `auth.users` crea fila |
| Frontend Vercel: login / signup / peso / calorías / agua / gráfico / correlación | ✅ | build verde + HTTP 200 |
| Backend `/api/correlacion` (JWT + RLS) | ✅ | `/health` ok, 401 sin token |
| **Motor `compute_weekly`** | ✅ | desplegado (2026-07-17) + secrets (SUPABASE_SERVICE_ROLE_KEY nativo) + prueba `{all:true}` ok |
| **Cron semanal `compute_weekly`** | ✅ | pg_cron `compute_weekly_all` lunes 06:00 UTC, activo |
| **Onboarding** (altura/objetivo/déficit) | ✅ | UI en primer login, guarda en `perfiles` |
| **Pantalla "Hoy" + coach** | ✅ | meta diaria + restante + TDEE + nota coach (web/app/page.tsx + lib/coach.ts) |
| **Escáner barcode (`scan_barcode`)** | ❌ | código listo, **NO desplegado**, sin UI |
| **Diseño / UX** | ⚠️ | funcional pero "básico", clases inline sueltas, sin tabs/dark mode |
| **Tests backend FastAPI** | ❌ | solo testeada la matemática, no los endpoints |
| **CI** | ❌ | no hay GitHub Actions |

---

## 3. Lo que falta, en profundidad

### A. Funcionalidad core (el "cerebro" de MacroFactor)
1. **Superficie el motor adaptativo.** `compute_weekly` ya calcula
   `tdee_actual` y `target_intake`, pero no está deployado ni corre solo ni
   se muestra. Hoy el usuario no ve su gasto estimado ni su objetivo diario.
2. **Pantalla "Hoy" con target.** Mostrar: calorías objetivo del día,
   consumidas, restante; TDEE estimado; peso trend.
3. **Coach / recomendación.** `coach.py` tiene la lógica (cut/bulk/maint,
   signo del ajuste) pero no está expuesta en UI.
4. **Onboarding.** Al primer login pedir altura, objetivo, % déficit.
   Hoy `perfiles` queda con defaults (2500 / cut / 15%).
5. **Checkins semanales visibles.** Delta de peso, confianza, TDEE por semana.
6. **Historial editable / borrable.**

### B. Diferencial agua (empezado)
7. Correlación con ventana 60-90 días + interpretación clara.
8. Recordatorios de agua (push/notificación).
9. Meta de agua configurable (hoy hardcode 3000 ml).

### C. Comida
10. Integrar scanner barcode en registro de comida → Open Food Facts →
    caché en `alimentos`. Hoy no hay UI de comida.
11. Registro de comidas por día (no solo un número total).

### D. Diseño / UX
12. Sistema de diseño real: tokens, componentes (Card/Button/Input),
    dark mode, responsive, iconos.
13. Navegación por tabs: Hoy / Semana / Agua / Perfil.
14. Estados vacíos, loading skeletons, feedback de guardado.

### E. Infra / despliegue
15. Deploy Edge Functions + set `SERVICE_ROLE` secret.
16. Cron semanal (recomendado: pg_cron de Supabase).
17. Tests del backend FastAPI (endpoints).
18. CI (GitHub Actions: pytest + tsx + build).

### F. Seguridad (crítico, pendiente desde el inicio)
19. **Rotar `service_role` + password BD expuestas en el chat.**
20. Rate limit en `/api/correlacion`.
21. Vigilar no commitear secrets.

---

## 4. Roadmap por fases (propuestas — requieren aprobación)

### Fase 1 — Que sea útil (ALTO valor, medio esfuerzo)  ← COMPLETA (2026-07-17)
- [x] Deploy `compute_weekly` (Edge Function) + secrets (SUPABASE_SERVICE_ROLE_KEY nativo).
- [x] Cron semanal (pg_cron) que invoca `compute_weekly` (lunes 06:00 UTC).
- [x] Onboarding: altura / objetivo / % déficit en primer login.
- [x] Pantalla "Hoy": target de calorías + restante + TDEE estimado + coach.
- **Resultado:** la app ya "es MacroFactor" y da valor real.

### Fase 2 — Que se vea producto (medio esfuerzo)  ← SIGUIENTE
- [ ] Sistema de diseño + navegación por tabs + dark mode + estados vacíos.
- [ ] Meta de agua configurable + recordatorios.

### Fase 3 — Diferencial comida (mayor esfuerzo)
- [ ] Scanner barcode + registro de comidas por día + caché `alimentos`.
- [ ] Correlación agua 60-90 días + interpretación.

### Fase 4 — Robustez (bajo/medio)
- [ ] Tests backend FastAPI + CI (GitHub Actions).
- [ ] Rate limit backend.
- [ ] (Fase 4 NO aplica para rotar credenciales — eso es YA, ver §5.)

---

## 5. Seguridad (CRÍTICA, independiente de las fases)

Las siguientes credenciales fueron pegadas en el chat y **deben rotarse**:
- `service_role` key de Supabase.
- Password de la BD (si fue compartida).
- Email/password de prueba `lbustos@edu21.cl` / `84788990Lbf` (cambiar tras prueba).

La `anon` key es pública por diseño (va en el bundle del frontend) — no
requiere rotación. El backend FastAPI usa solo la `anon` + JWT del usuario
(RLS intacta), nunca `service_role` en runtime.

---

## 6. Pendientes de decisión del usuario

1. ¿Priorizamos **Fase 1 (útil)** o **Fase 2 (diseño)** primero?
   → Recomendación: Fase 1 (hoy la app no da el valor central).
2. Cron: ¿**pg_cron** (SQL simple, dentro de Supabase) o cron externo?
   → Recomendación: pg_cron.
3. Comida: ¿scanner barcode primero o registro manual primero?
4. ¿Rotar credenciales ya? (Independiente de todo lo demás.)
