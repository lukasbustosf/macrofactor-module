/**
 * Núcleo de nutrición adaptativa (estilo MacroFactor / MVP de la investigación).
 *
 * Algoritmo PRINCIPAL: los 4 pasos del plano del MVP (promedios semanales).
 *   P1. delta_peso = avg(peso_esta_semana) - avg(peso_semana_pasada)
 *   P2. deficit_real_diario = -delta_peso * 7700 / 7
 *   P3. TDEE = avg(calorias_esta_semana) + deficit_real_diario
 *   P4. meta = TDEE * (1 - deficit_objetivo)
 *
 * También se incluye la filosofía alternativa (tasa % peso corporal/semana) por
 * si se quiere comparar, pero el MVP usa la de arriba.
 *
 * Equivalente calórico por kg de tejido (constante MacroFactor base).
 */
export const KCAL_PER_KG = 7700;

export interface DailyLog {
  day: string; // YYYY-MM-DD
  weightKg: number | null;
  intakeKcal: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  waterMl?: number;
}

export interface WeeklyResult {
  tdee: number;
  metaDiaria: number;
  deltaPesoKg: number;
  deficitRealDiario: number;
  promedioCalorias: number;
  semanaActualPeso: number | null;
  semanaPasadaPeso: number | null;
}

function weekKey(d: Date): string {
  // Lunes de la semana ISO a la que pertenece el día.
  const day = d.getUTCDay() || 7; // domingo=0 -> 7
  const monday = new Date(d.getTime());
  monday.setUTCDate(d.getUTCDate() - (day - 1));
  return monday.toISOString().slice(0, 10);
}

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Recomputo semanal estilo MVP (tu algoritmo de 4 pasos).
 * `logs` puede contener varias semanas; usa la última y la anterior.
 */
export function weeklyRecompute(
  logs: DailyLog[],
  deficitObjetivo: number = 0.15,
): WeeklyResult {
  const byWeek = new Map<string, DailyLog[]>();
  for (const l of logs) {
    const key = weekKey(new Date(l.day + "T00:00:00Z"));
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key)!.push(l);
  }

  const weeks = [...byWeek.keys()].sort();
  if (weeks.length === 0) {
    return {
      tdee: 0,
      metaDiaria: 0,
      deltaPesoKg: 0,
      deficitRealDiario: 0,
      promedioCalorias: 0,
      semanaActualPeso: null,
      semanaPasadaPeso: null,
    };
  }

  const thisWeek = byWeek.get(weeks[weeks.length - 1])!;
  const weightsThis = thisWeek
    .map((l) => l.weightKg)
    .filter((w): w is number => w !== null && w !== undefined);
  const kcalThis = thisWeek.map((l) => l.intakeKcal);

  const promPesoThis = mean(weightsThis);
  const promKcal = mean(kcalThis) ?? 0;

  let deltaPeso = 0;
  let promPesoPrev: number | null = null;
  if (weeks.length >= 2) {
    const prevWeek = byWeek.get(weeks[weeks.length - 2])!;
    const weightsPrev = prevWeek
      .map((l) => l.weightKg)
      .filter((w): w is number => w !== null && w !== undefined);
    promPesoPrev = mean(weightsPrev);
    if (promPesoPrev !== null && promPesoThis !== null) {
      deltaPeso = promPesoThis - promPesoPrev;
    }
  }

  const deficitRealDiario = (-deltaPeso * KCAL_PER_KG) / 7;
  const tdee = promKcal + deficitRealDiario;
  const meta = tdee * (1 - deficitObjetivo);

  return {
    tdee,
    metaDiaria: meta,
    deltaPesoKg: deltaPeso,
    deficitRealDiario,
    promedioCalorias: promKcal,
    semanaActualPeso: promPesoThis,
    semanaPasadaPeso: promPesoPrev,
  };
}

/**
 * Filosofía alternativa (MacroFactor clásico): tasa % de peso corporal/semana.
 * Se mantiene para comparar, no es la del MVP.
 */
export function recommendByRate(
  expenditureKcal: number,
  trendWeightKg: number,
  ratePctPerWeek: number,
): number {
  const weeklyChangeKg = trendWeightKg * (ratePctPerWeek / 100);
  return expenditureKcal + (weeklyChangeKg * KCAL_PER_KG) / 7;
}
