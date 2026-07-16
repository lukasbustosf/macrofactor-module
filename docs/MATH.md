# Documentación matemática — Módulo de nutrición adaptativa (estilo MacroFactor)

> Estado: borrador estructurado a partir del conocimiento general de la app y la
> implementación base en `src/macrofactor/`. Los bloques `TODO(lukas)` deben
> validarse/ajustarse con la investigación que aportes. No afirmamos aquí nada
> que no esté verificado en vivo.

---

## 1. Principio rector: gasto estimado, no impuesto

Apps tipo MyFitnessPal fijan el TDEE con una fórmula poblacional
(Mifflin–St Jeor, Katch–McArdle, etc.) y nunca lo corrigen. MacroFactor
**estima el gasto real del usuario** a partir de su propio balance
energético observado y lo actualiza con el tiempo.

Definición de balance energético diario:

```
balance_día = ingesta_día − gasto_día
```

Acumulado sobre una ventana:

```
Σ balance = Σ ingesta − Σ gasto
```

Y por conservación de energía ese balance acumulado se traduce en cambio de
masa corporal:

```
Σ balance ≈ k · (peso_final − peso_inicial)
```

donde `k` es el equivalente calórico por kg de tejido. **Valor base usado:**
`k = 7700 kcal/kg` (aprox. MacroFactor). `TODO(lukas):` MF ajusta `k` por
composición (grasa vs magro) y signo del balance; confirmar.

---

## 2. Tendencia de peso (suavizado)

El peso diario es ruidoso (hidratación, comida en tracto, hora de pesada).
Trabajamos con una **tendencia** y no con el peso crudo.

### 2.1 Media móvil exponencial (EMA)
Para una serie de pesos `w_1..w_n`:

```
s_1 = w_1
s_i = α · w_i + (1−α) · s_{i−1}      α ∈ (0,1]
```

`α` pequeño ⇒ tendencia más suave (ventana efectiva larga). Implementado en
`weight_trend.compute_trend` con `α = 0.05` por defecto. `TODO(lukas):`
confirmar el α/τ real de MF (equivalente a ventana de ~N días).

### 2.2 Pendiente (tasa de cambio real)
Regresión lineal sobre los días relativos al primero:

```
peso = m · t_días + b
slope_kg_per_day = m
slope_kg_per_week = m · 7
```

`r²` del ajuste se usa como proxy de confianza. Requerimos `min_points`
(7 por defecto) para emitir pendiente.

---

## 3. Estimación del TDEE

Sobre una ventana reciente (`window_days = 21` por defecto), asumiendo gasto
aprox. constante en la ventana:

```
Δpeso_tendencia (kg) = slope_kg_per_day · n_días
Δpeso_tendencia (kcal) = k · Δpeso_tendencia (kg)
gasto ≈ media(ingesta) − Δpeso_tendencia(kcal) / n_días
```

Intuición: si comes 2500 y tu tendencia baja, tu gasto real > 2500. Si sube,
gasto real < 2500.

### 3.1 Confianza
`conf = min(1, n_días/21) · (0.5 + 0.5·r²)`. Umbral bajo (<0.4) ⇒ avisar al
usuario que siga registrando. `TODO(lukas):` refinar el modelo de confianza
(¿varianza del peso?, ¿adherencia al registro?).

---

## 4. Motor de coaching (recomendación de ingesta)

El usuario fija la **velocidad** (tasa % de peso corporal / semana); la app
calcula las **calorías**.

```
weekly_change_kg = peso_tendencia · (rate_pct_per_week / 100)
intake = gasto_estimado + weekly_change_kg · k / 7
```

- `rate < 0` (CUT) → déficit.
- `rate > 0` (BULK) → superávit.
- `rate = 0` (MAINTENANCE) → mantenimiento.

Objetivos: `CUT`, `BULK`, `MAINTENANCE`, `CUSTOM`. `TODO(lukas):` rangos por
defecto de MF (cut 0.5–1.0%/sem, bulk ~0.25–0.5%/sem), pisos/máximos de kcal,
y si aplica corrección dinámica cuando la tasa real se desvía de la objetivo.

---

## 5. Filosofía de ejercicio (NO sumar calorías quemadas)

La actividad física **no** se suma al objetivo. Motivo: el gasto por ejercicio
ya queda **absorbido** en el TDEE estimado, porque el estimador lo ve reflejado
en el balance energético real (comes igual, peso baja más rápido ⇒ gasto sube).
Sumarlo ingenuamente (como hacen relojes/cintas) duplica el efecto y provoca
sobreingesta. Implementado implícitamente: `recommend` usa solo `expenditure`
estimado; no añade campo de "quemadas". `TODO(lukas):` confirmar que MF no
ofrece tampoco "eat back" en modoadaptive.

---

## 6. Check-in

Resumen periódico (MF: semanal) mostrando:
- gasto estimado (TDEE),
- tendencia de peso y pendiente,
- adherencia al registro,
- recomendación de ingesta.

`TODO(lukas):` definir frecuencia, métricas exactas y formato del reporte.

---

## 7. Validación contra la investigación aportada (fuente secundaria)

> ⚠️ La investigación es un resumen de terceros (no docs oficiales de MacroFactor).
> Confirma la dirección del algoritmo y coincide con la implementación, pero los
> parámetros finos aún deben verificarse en vivo contra la app real.

Puntos **confirmados** por la fuente (y coherentes con `src/`):
- [x] **No es ML profundo / ChatGPT**: es estadística determinista + termodinámica. ✓
- [x] **k = 7,700 kcal/kg** de tejido. ✓ (implementado en `models.weight_delta_to_kcal`)
- [x] **Ejemplo canónico**: 2,500 kcal + pérdida 0.5 kg/sem → TDEE 3,050. ✓ (verifica `coach.recommend`)
- [x] **Suavizado**: EMA **o** filtro de Kalman **o** regresión lineal sobre 14–21 días.
      Implementamos EMA + regresión lineal (ventana 21 d por defecto). `TODO(lukas):`
      evaluar añadir filtro de Kalman como alternativa de suavizado.
- [x] **Filosofía Adherence Neutral** (ver §8).

Puntos **aún abiertos** (no cubiertos por la fuente):
- [ ] Ventana y modelo de TDEE (constante vs variable; rolling real de MF).
- [ ] Rangos por defecto de tasas y límites de kcal (cut/bulk).
- [ ] Corrección dinámica de la recomendación (auto-adjust cuando la tasa real
      se desvía de la objetivo).
- [ ] Detalle del check-in (frecuencia, métricas exactas, formato).
- [ ] ¿`k` varía por composición de tejido (grasa vs magro) y por sexo?

---

## 8. Principio "Adherence Neutral" (diseño clave)

MacroFactor **no juzga ni castiga**. Si el usuario se come 5,000 kcal un día, la
app no pone alertas rojas ni le baja las calorías al día siguiente. Simplemente
usa ese dato para alimentar el algoritmo y entender mejor su metabolismo.

Implicación en nuestro módulo: `coach.recommend` ya es adherence-neutral por
construcción (no aplica penalizaciones; solo recalcula gasto + objetivo con los
datos reales). **No** añadir lógica de "castigo" ni alertas por día aislado.

Ideas de diferencial sugeridas en la investigación (no implementadas aún):
- Sugerir más agua si el algoritmo detecta un **estancamiento brusco** de peso.
- Acomodar macros automáticamente según **horario de entrenamiento**.

---

## 9. Stack sugerido en la investigación (nota de arquitectura)

La fuente propone un stack web distinto al módulo Python actual:
- **Supabase (PostgreSQL)**: tablas `users`, `daily_logs` (calorías/macros),
  `weight_logs`. Queries de los últimos 21 días.
- **Railway (cron)**: job semanal que recalcula TDEE y actualiza metas.
- **Next.js (frontend)**: dashboards con Recharts/Chart.js.

⚠️ **Decisión pendiente**: nuestro módulo de referencia está en **Python**
(opción B que elegiste). Esta investigación propone **TypeScript/Supabase**.
No son excluyentes: el Python puede ser el motor de cálculo/referencia y el
esquema SQL + funciones TS viven en el producto web. Ver sección 10.

---

## 10. Modelo de base de datos propuesto (Supabase/Postgres)

Esquema inicial para que el algoritmo funcione (a confirmar por ti):

```sql
-- Usuarios y objetivo
create table users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  sex text check (sex in ('male','female')),
  start_weight_kg numeric,
  objective text check (objective in ('cut','bulk','maintenance','custom')),
  rate_pct_per_week numeric default 0  -- negativo=cut, positivo=bulk
);

-- Registro diario de ingesta (1 fila/día)
create table daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  log_date date not null,
  intake_kcal numeric not null,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  unique (user_id, log_date)
);

-- Registro diario de peso (puede faltar días)
create table weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  log_date date not null,
  weight_kg numeric not null,
  unique (user_id, log_date)
);

-- Resultado del check-in semanal (lo escribe el cron)
create table checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  week_start date not null,
  estimated_tdee numeric,
  target_intake_kcal numeric,
  trend_weight_kg numeric,
  trend_slope_kg_per_week numeric,
  confidence numeric
);
```

> `TODO(lukas):` confirmar nombres, índices, y si `daily_logs` y `weight_logs`
> se unen en una sola tabla `daily_log`. El algoritmo (Python) es agnóstico a
> esto: solo necesita `(date, weight_kg?, intake_kcal)` por día.

---

## 11. Plano del MVP según la investigación (Supabase)

Esquema propuesto en la fuente para el MVP (tablas en español, auth de Supabase):

```sql
-- 1) perfiles (configuración del usuario)
create table perfiles (
  id uuid references auth.users not null primary key,
  updated_at timestamp with time zone,
  altura_cm int,
  deficit_objetivo float default 0.15,  -- 0.15 = 15%, 0.20 = 20%
  tdee_actual int default 2500          -- gasto estimado inicial
);

-- 2) registros_diarios (corazón del algoritmo)
create table registros_diarios (
  id bigint generated by default as identity primary key,
  user_id uuid references auth.users not null,
  fecha date not null default current_date,
  peso_kg float,                      -- peso en ayunas
  calorias_consumidas int default 0,
  proteinas_g int default 0,
  carbohidratos_g int default 0,
  grasas_g int default 0,
  agua_ml int default 0,              -- control de 3 litros
  unique (user_id, fecha)            -- 1 registro por día
);
```

> ⚠️ **Nota de congruencia**: este esquema difiere del de §10 (inglés, 3 tablas).
> El de acá es el **MVP concreto** que propone la fuente; el de §10 es el modelo
> "estilo MacroFactor completo". Se recomienda unificar antes de build: elegir
> un esquema. El módulo Python es agnóstico al nombre de tablas.

---

## 12. Algoritmo del MVP en 4 pasos (promedios semanales)

Implementado en `weekly_mvp.weekly_recompute`. Diferente al de `tdee_estimator`
(EMA/regresión): usa **promedio de esta semana − promedio de la semana pasada**.

```
P1. delta_peso = avg(peso_esta_semana) - avg(peso_semana_pasada)
P2. deficit_real_semanal = -delta_peso * 7700
    deficit_real_diario  = deficit_real_semanal / 7
P3. TDEE = avg(calorias_esta_semana) + deficit_real_diario
P4. meta = TDEE * (1 - deficit_objetivo)
```

### Ejemplo validado (test `test_mvp_weekly_example_2040`)
- Semana pasada avg 99.0 kg; esta semana avg 98.5 kg → delta = **−0.5 kg**.
- Calorías promedio = 2,000/día.
- TDEE = 2000 + (0.5·7700/7) = 2000 + 550 = **2,550**.
- déficit 20% → meta = 2,550 · 0.80 = **2,040 kcal/día**. ✓ (test pasa)

### Diferencia clave con la filosofía (A) de `coach`
| | MVP (§12) | coach filosofía A |
|---|---|---|
| Control | % déficit sobre mantenimiento | % peso corporal/sem |
| Ventana | semanas (delta) | 21 d EMA + regresión |
| Meta | TDEE·(1−d) | expenditure + Δkcal |

Ambos correctos; el producto debe elegir uno (o dejar configurable).

---

## 13. Diferencial del AGUA (ventaja sobre MacroFactor)

La fuente señala un diferenciador para el caso específico del usuario
(estreñimiento + retención de líquidos): **correlacionar agua ingerida con
caída de peso al día siguiente**.

- Campo `agua_ml` en `registros_diarios` (meta 3,000 ml / 3 L).
- UI: botón grande "**+ 500 ml**" en ayunas; check verde al llegar a 3,000 ml.
- Análisis sugerido: al día siguiente de días con ≥3,000 ml, el peso tiende a
  bajar (mayor evacuación / menos retención). Visualizar la correlación.

`TODO(lukas):` esto aún NO está en el motor Python. Posible módulo futuro
`hydration.py` que calcule correlación (lag 1 día) agua↔Δpeso. Es un diferencial
real y barato de implementar.

---

## 14. Motivación / por qué este proyecto

Resumen de la tesis de la investigación (para mantener el norte):
- Ahorro de ~60.000 CLP/año de suscripción + app 100% a tu pinta.
- "Si no lo mides, no lo puedes controlar": tablero de control estricto contra
  el sobreconsumo calórico.
- Para un dev, resolver un problema propio (peso/comida) es el mejor proyecto.
- El diferencial del agua es único y útil para el caso clínico particular.

> Próximo paso sugerido por la fuente: crear repo en GitHub y tirar las primeras
> líneas este fin de semana. `TODO(lukas):` decidir si el repo es Python (este
> módulo) o TS/Supabase (según §9/§11). **Decidido (Go 1):** se usa TS/Supabase
> como producción; Python queda como motor de referencia/tests. ✓

---

## 15. Base de datos de comida (el corazón de la app)

Para no ingresar cada alimento a mano, la investigación propone conectarse a
APIs ya existentes con millones de alimentos y macros exactos:

| API | Costo | Notas de la fuente |
|---|---|---|
| **Open Food Facts** | Gratis | "La Wikipedia de la comida". API enorme y muy usada. Base de código de barras. |
| **FatSecret API** | Gratis al inicio | La más exacta para macros; la usan muchísimas apps de fitness. |
| **Edamam** | Gratis para proyectos chicos | Muy buena para ingredientes crudos o recetas. |

`TODO(lukas):` elegir proveedor inicial. Recomendación: **Open Food Facts**
(arranque 0 costo, escáner de código de barras inmediato) + FatSecret como
respaldo de precisión cuando se necesite.

### Integración sugerida (Supabase Edge Function o Next.js API route)
- Escáner de código de barras en el frontend (librería `html5-qrcode`, activa
  la cámara desde la web).
- Al escanear, consulta `Open Food Facts`:
  `GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json`
- Mapea `product.nutriments` (energy-kcal_100g, proteins_100g, carbs_100g,
  fat_100g) a `registros_diarios` (o a una tabla `alimentos_log` por porción).
- Guarda en Supabase (tabla `alimentos` cache/local si se quiere evitar rate limits).

---

## 16. Fotos vs pesar la comida (criterio de experto)

La investigación valida una postura clave: **la IA de fotos de plato es marketing,
no utilidad real para bajar grasa**.

- Una foto de "arroz con pollo" no distingue 150 g de 300 g de arroz. Esa
  diferencia de gramos es la que define si bajas o subes de peso.
- Para alguien que realmente quiere bajar grasa, **pesar la comida es la única
  verdad** (el usuario es usuario avanzado y lo sabe).

### Dónde SÍ usar IA (útil y barato): "Lector de etiquetas"
En vez de escanear el plato, usar IA para leer **tablas nutricionales de paquetes
raros / en otros idiomas**:
1. Foto a la tabla nutricional del paquete.
2. Backend Next.js manda la foto a GPT-4o Vision o Gemini.
3. La IA devuelve JSON limpio: `{ kcal, proteinas_g, carbos_g, grasas_g }`.
4. La app lo guarda en la base de datos personal (Supabase).

Esto complementa —no reemplaza— el pesado real. El diferencial es resolución de
etiquetas que no están en la API de código de barras.

> `TODO(lukas):` módulo futuro `vision_label.ts` (Edge Function que llama al
> proveedor de visión y parsea a JSON). Fuera del MVP core de TDEE.

---

## 17. Estado de los entregables (tras Go 1)

- [x] **Python** (motor de referencia + tests): `tdee_estimator`, `weight_trend`,
      `coach` (filosofías A y B), `weekly_mvp`. 6/6 tests pasan.
- [x] **TypeScript** (producción Supabase): `nutrition.ts` con `weeklyRecompute`
      (tu algoritmo de 4 pasos, PRINCIPAL) + `recommendByRate` (alternativo).
      `compute_weekly` Edge Function esqueleto. 4/4 tests TS pasan.
- [x] Docs: §1–§16 cubiertas (matemática, MVP, agua, comida, fotos).
- [ ] **Pendiente**: unificar esquema SQL (§10 vs §11), cablear `compute_weekly`
      al cliente real de Supabase, e integrar escáner de código de barras (§15).
