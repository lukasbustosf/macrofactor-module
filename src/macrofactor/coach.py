"""Motor de coaching: recomendación de ingesta según objetivo.

Diferenciador clave de MacroFactor: el usuario fija la *velocidad* (tasa de
cambio de peso), y la app calcula las *calorías*. El objetivo calórico se
reajusta automáticamente cuando el gasto estimado cambia.

    target_intake = expenditure − (objetivo_Δpeso_semanal_kg * 7700 / 7)

- CUT:    rate negativo → déficit.
- BULK:   rate positivo → superávit.
- MAINT:  rate 0 → mantenimiento.
- CUSTOM: rate libre.

Filosofía de ejercicio: la actividad NO se suma ingenuamente al objetivo. El
gasto por actividad queda *absorbido* dentro del TDEE estimado (porque el
estimador ya lo ve reflejado en el balance energético real). Por eso el
recomendador no añade "calorías quemadas por workout" al objetivo.

TODO(lukas): validar rangos/redondeos y si MF impone pisos/máximos (ej. no bajar
de X kcal, no superávit > Y% del peso). También si aplica un "dynamic" que
corrige la recomendación cuando la tasa real se desvía de la objetivo.
"""
from __future__ import annotations

from typing import Sequence

from .models import DailyLog, Objective, Recommendation, weight_delta_to_kcal
from .tdee_estimator import estimate_tdee
from .weight_trend import compute_trend


def recommend(
    logs: Sequence[DailyLog],
    objective: Objective,
    kcal_per_kg: float = 7700.0,
) -> Recommendation:
    """Recomienda ingesta diaria para alcanzar la tasa de cambio objetivo.

    La tasa es % de peso corporal por semana; el peso de referencia es el de
    tendencia actual (no el de inicio), porque es lo que el usuario pesa hoy.
    """
    est = estimate_tdee(logs)
    trend = compute_trend(logs)

    # --- Filosofía (B): porcentaje de déficit/superávit sobre mantenimiento ---
    if objective.deficit_pct != 0.0:
        target = est.expenditure_kcal * (1.0 - objective.deficit_pct)
        expected_weekly_change_kg = (target - est.expenditure_kcal) * 7.0 / kcal_per_kg
        note = (f"Meta = mantenimiento ({est.expenditure_kcal:.0f}) "
                f"x (1 - {objective.deficit_pct:.0%}).")
        if est.confidence < 0.4:
            note += " Estimación de baja confianza: sigue registrando."
        return Recommendation(
            objective=objective.type,
            target_intake_kcal=float(target),
            estimated_expenditure_kcal=est.expenditure_kcal,
            expected_weekly_change_kg=float(expected_weekly_change_kg),
            note=note,
        )

    # --- Filosofía (A): tasa por % de peso corporal por semana ---
    # Cambio de peso deseado por semana (kg) derivado de la tasa %/semana
    ref = trend.trend_kg if trend.trend_kg else 0.0
    weekly_change_kg = ref * (objective.rate_pct_per_week / 100.0)

    # Calorías a sumar/restar por día para lograr ese cambio semanal.
    # weekly_change = (intake - expenditure) * 7 / 7700
    #   =>  intake = expenditure + weekly_change * 7700 / 7
    # rate positivo (bulk) => superávit; negativo (cut) => déficit.
    daily_delta = weight_delta_to_kcal(weekly_change_kg) / 7.0

    target = est.expenditure_kcal + daily_delta

    note = ""
    if est.confidence < 0.4:
        note = "Estimación de baja confianza: pocos días / ruido alto. Sigue registrando."
    elif objective.rate_pct_per_week == 0.0:
        note = "Mantenimiento: come cerca de tu gasto estimado."

    return Recommendation(
        objective=objective.type,
        target_intake_kcal=float(target),
        estimated_expenditure_kcal=est.expenditure_kcal,
        expected_weekly_change_kg=float(weekly_change_kg),
        note=note,
    )
