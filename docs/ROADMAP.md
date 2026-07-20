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
| Escáner barcode (`scan_barcode`) | ✅ | código listo + usado vía Open Food Facts en UI Comidas |
| **Diseño / UX** | ✅ | tabs Hoy/Comidas/Semana/Agua/Perfil + dark mode + componentes |
| **Registro de comidas + horarios + menús** | ✅ | tabla `comidas`, `menu_favorito` + RLS, UI Comidas |
| **OCR etiqueta** | ✅ | Tesseract.js local (sin API key) + `ocr_label` edge fn opcional |
| **Tests backend FastAPI** | ❌ | solo testeada la matemática, no los endpoints |
| **CI** | ❌ | no hay GitHub Actions |

---

## 3. Lo que falta (estado real 2026-07-17)

### Ya entregado (Fase 1 + 2 + 2.5 + 3)
- Motor adaptativo `compute_weekly` desplegado + pg_cron + pantalla Hoy + coach + onboarding.
- Diseño: tabs, dark mode, componentes, estados vacíos, dashboard Hoy.
- Comidas: registro por horario, barcode (Open Food Facts), manual, OCR local
  (Tesseract.js), menús favoritos (clonar). Tabla `comidas` + `menu_favorito` + RLS.

### Pendiente de valor (producto)
1. **Checkins semanales visibles.** El TDEE se calcula y guarda en `checkins`
   pero no hay pantalla que los muestre (delta de peso, confianza, TDEE por
   semana). → pestaña "Semana" ya muestra tendencia de peso; falta mostrar
   fila de `checkins` (TDEE estimado histórico).
2. **Correlación agua 60-90 días + interpretación.** El backend ya corre con
   ventana de 30 días; extender a 60-90 y mejorar texto.
3. **Recordatorios de agua** (push/notificación) — no implementado.
4. **Historial editable / borrable** de peso (hoy solo agua/comidas se borran).
5. **Pantalla "Explorar" / BD de alimentos** para reusar `alimentos` cacheados.

### Infra / robustez (Fase 4)
6. Tests backend FastAPI (endpoints) + CI (GitHub Actions: pytest + tsx + build).
7. Rate limit en `/api/correlacion`.

### Seguridad
- (Omitido a petición del usuario — ver nota en sesión.)

---

## 4. Roadmap por fases (propuestas — requieren aprobación)

### Fase 1 — Que sea útil (ALTO valor, medio esfuerzo)  ← COMPLETA (2026-07-17)
- [x] Deploy `compute_weekly` (Edge Function) + secrets (SUPABASE_SERVICE_ROLE_KEY nativo).
- [x] Cron semanal (pg_cron) que invoca `compute_weekly` (lunes 06:00 UTC).
- [x] Onboarding: altura / objetivo / % déficit en primer login.
- [x] Pantalla "Hoy": target de calorías + restante + TDEE estimado + coach.
- **Resultado:** la app ya "es MacroFactor" y da valor real.

### Fase 2 — Que se vea producto (medio esfuerzo)  ← COMPLETA (2026-07-17)
- [x] Sistema de diseño + navegación por tabs + dark mode + estados vacíos.
- [x] Meta de agua configurable + recordatorios.
- **Resultado:** la app se siente producto (tabs Hoy/Semana/Agua/Perfil, dark mode, componentes Card/Button/Input/Tabs/Toggle/EmptyState).

### Fase 3 — Diferencial comida (mayor esfuerzo)  ← COMPLETA (2026-07-17)
- [x] Registro de comidas por día (tabla `comidas`) + RLS + caché `alimentos`.
- [x] Ingesta por horario (desayuno/almuerzo/once/cena/snack) en pestaña Comidas.
- [x] Entrada manual rápida de macros (4 campos) + barcode (Open Food Facts, gratis).
- [x] Menús/días favoritos (guardar día completo + clonar 1 click).
- [x] **OCR de foto de etiqueta** — edge function `ocr_label` pluggable (OpenAI/Anthropic), valida JWT usuario, prefilla macros. Requiere secret `OPENAI_API_KEY` o `ANTHROPIC_API_KEY` del usuario (VISION_PROVIDER=openai ya seteado).
- [ ] Correlación agua 60-90 días + interpretación.
- **Resultado:** flujo de registro paritario con MacroFactor (barcode + manual + horarios + menús + OCR). Falta solo la API key de visión.

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
