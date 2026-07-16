import {
  weeklyRecompute,
  recommendByRate,
  DailyLog,
  KCAL_PER_KG,
} from "../supabase/functions/_shared/nutrition.ts";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("  ✗ FAIL:", msg);
  } else {
    console.log("  ✓", msg);
  }
}
function approx(a: number, b: number, tol = 1e-6) {
  return Math.abs(a - b) <= tol;
}

console.log("== Test 1: ejemplo canónico MVP (Lukas) ==");
// Semana pasada avg 99.0, esta semana avg 98.5 -> delta -0.5 kg
// calorías prom 2000 -> TDEE = 2000 + 550 = 2550 -> 20% déficit -> 2040
const logs: DailyLog[] = [];
for (let i = 0; i < 7; i++) {
  const d = new Date(Date.UTC(2026, 0, 5 + i)); // lun 5 ene
  logs.push({ day: d.toISOString().slice(0, 10), weightKg: 99.0, intakeKcal: 2000 });
}
for (let i = 0; i < 7; i++) {
  const d = new Date(Date.UTC(2026, 0, 12 + i)); // lun 12 ene
  logs.push({ day: d.toISOString().slice(0, 10), weightKg: 98.5, intakeKcal: 2000 });
}
const r = weeklyRecompute(logs, 0.20);
assert(approx(r.deltaPesoKg, -0.5), `delta_peso = -0.5 (got ${r.deltaPesoKg})`);
assert(approx(r.tdee, 2550), `TDEE = 2550 (got ${r.tdee})`);
assert(approx(r.metaDiaria, 2040), `meta = 2040 (got ${r.metaDiaria})`);

console.log("== Test 2: mantenimiento sin cambio de peso ==");
const logs2: DailyLog[] = [];
for (let i = 0; i < 7; i++) {
  const d = new Date(Date.UTC(2026, 0, 5 + i));
  logs2.push({ day: d.toISOString().slice(0, 10), weightKg: 80.0, intakeKcal: 2200 });
}
for (let i = 0; i < 7; i++) {
  const d = new Date(Date.UTC(2026, 0, 12 + i));
  logs2.push({ day: d.toISOString().slice(0, 10), weightKg: 80.0, intakeKcal: 2200 });
}
const r2 = weeklyRecompute(logs2, 0.15);
assert(approx(r2.tdee, 2200, 1e-9), `TDEE = 2200 sin cambio (got ${r2.tdee})`);
assert(
  approx(r2.metaDiaria, 2200 * 0.85),
  `meta = 1870 con 15% déficit (got ${r2.metaDiaria})`,
);

console.log("== Test 3: constante KCAL_PER_KG ==");
assert(KCAL_PER_KG === 7700, "K = 7700 kcal/kg");

console.log("== Test 4: filosofía alternativa (tasa) ==");
// expenditure 2550, peso 98.5, tasa -0.5%/sem
const alt = recommendByRate(2550, 98.5, -0.5);
// 2550 + (98.5 * -0.5/100 * 7700)/7 = 2550 - 542.375 = 2007.625
assert(approx(alt, 2550 - (98.5 * 0.005 * 7700) / 7), `tasa -0.5%/sem (got ${alt})`);

console.log("== Test 5: flujo end-to-end simulado (forma de compute_weekly) ==");
// Simula lo que hace compute_weekly: mapea filas de Supabase -> DailyLog[] -> weeklyRecompute
const rows = [
  { fecha: "2026-01-05", peso_kg: 99.0, calorias_consumidas: 2000, agua_ml: 3000 },
  { fecha: "2026-01-06", peso_kg: 99.0, calorias_consumidas: 2000, agua_ml: 2500 },
  { fecha: "2026-01-07", peso_kg: 99.0, calorias_consumidas: 2000, agua_ml: 3000 },
  { fecha: "2026-01-12", peso_kg: 98.5, calorias_consumidas: 2000, agua_ml: 3000 },
  { fecha: "2026-01-13", peso_kg: 98.5, calorias_consumidas: 2000, agua_ml: 3000 },
  { fecha: "2026-01-14", peso_kg: 98.5, calorias_consumidas: 2000, agua_ml: 3000 },
];
const mapped: DailyLog[] = rows.map((r) => ({
  day: r.fecha,
  weightKg: r.peso_kg,
  intakeKcal: r.calorias_consumidas,
  waterMl: r.agua_ml,
}));
const endRes = weeklyRecompute(mapped, 0.20);
assert(approx(endRes.tdee, 2550), `E2E TDEE = 2550 (got ${endRes.tdee})`);
assert(approx(endRes.metaDiaria, 2040), `E2E meta = 2040 (got ${endRes.metaDiaria})`);

if (failures > 0) {
  console.error(`\n${failures} test(s) fallaron`);
  process.exit(1);
} else {
  console.log("\nTodos los tests pasaron ✓");
}
