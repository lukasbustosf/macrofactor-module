// Coach adaptativo (port fiel de src/macrofactor/coach.py a TS).
//
// Filosofía: el usuario fija la VELOCIDAD (tasa % de peso corporal por semana,
// o % de déficit/superávit sobre mantenimiento) y la app calcula las calorías.
// El objetivo se reajusta solo cuando cambia el TDEE estimado.
//
// La actividad NO se suma al objetivo: queda absorbida en el TDEE estimado.

export interface CoachInput {
  tdee: number; // gasto estimado
  deficitPct: number; // 0.15 = 15% (de perfiles.deficit_objetivo)
  objetivo: "cut" | "bulk" | "maintenance" | "custom";
  trendPesoKg: number; // peso de tendencia actual (referencia)
  confidence: number; // 0..1
}

export interface CoachOutput {
  targetIntake: number;
  expectedWeeklyChangeKg: number;
  note: string;
}

export function coach(input: CoachInput): CoachOutput {
  const { tdee, deficitPct, objetivo, trendPesoKg, confidence } = input;

  // --- Filosofía (B): % de déficit/superávit sobre mantenimiento ---
  if (deficitPct !== 0) {
    const target = tdee * (1 - deficitPct);
    const expectedWeeklyChangeKg = ((target - tdee) * 7) / 7700;
    let note = `Meta = mantenimiento (${Math.round(tdee)}) x (1 - ${Math.round(
      deficitPct * 100,
    )}%).`;
    if (confidence < 0.4) note += " Estimación de baja confianza: sigue registrando.";
    return {
      targetIntake: target,
      expectedWeeklyChangeKg,
      note,
    };
  }

  // --- Filosofía (A): tasa % de peso corporal por semana ---
  // mapeo simple cut/bulk/maintenance -> rate %
  let ratePct = 0;
  if (objetivo === "cut") ratePct = -0.5; // -0.5%/sem es conservador
  else if (objetivo === "bulk") ratePct = 0.25;
  else ratePct = 0;

  const ref = trendPesoKg || 0;
  const weeklyChangeKg = (ref * ratePct) / 100;
  const dailyDelta = (weeklyChangeKg * 7700) / 7;
  const target = tdee + dailyDelta;

  let note = "";
  if (confidence < 0.4) {
    note = "Estimación de baja confianza: pocos días / ruido alto. Sigue registrando.";
  } else if (ratePct === 0) {
    note = "Mantenimiento: come cerca de tu gasto estimado.";
  }

  return {
    targetIntake: target,
    expectedWeeklyChangeKg: weeklyChangeKg,
    note,
  };
}
