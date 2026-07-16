"""Estimación dinámica del TDEE.

Principio central de MacroFactor (no es fórmula poblacional):

    Gasto ≈ Ingesta − cambio en reservas de energía

Es decir: si comes X calorías y tu peso (tendencia) sube, tu gasto real es
menor que X; si baja, tu gasto es mayor que X. Acumulando el balance calórico
(ingesta − gasto desconocido) y comparándolo con el cambio de peso observado,
se hace una regresión para estimar el gasto.

Matemática base:
    Σ(intake − expenditure) ≈ k · (peso_final − peso_inicial)
    con k = 7700 kcal/kg  (ver models.weight_delta_to_kcal)

Despejando expenditure (constante en la ventana):
    expenditure ≈ media(intake) − k · (Δpeso_tendencia / días)

TODO(lukas): validar contra tu investigación:
- ¿MF asume gasto constante o lo permite variar dentro de la ventana?
- ¿usa ventana móvil (rolling) y cuántos días?
- ¿cómo pondera la confianza (nº de días, varianza del peso, adherencia)?
"""
from __future__ import annotations

from datetime import date
from typing import Sequence

import numpy as np

from .models import DailyLog, TdeeEstimate, weight_delta_to_kcal
from .weight_trend import compute_trend


def estimate_tdee(
    logs: Sequence[DailyLog],
    window_days: int = 21,
    kcal_per_kg: float = 7700.0,
) -> TdeeEstimate:
    """Estima el TDEE a partir de los registros en una ventana reciente.

    Usa la tendencia de peso (no el crudo) para el Δpeso, reduciendo ruido.
    """
    if not logs:
        return TdeeEstimate(expenditure_kcal=0.0, confidence=0.0, window_days=0)

    last_day = max(l.day for l in logs)
    cutoff = last_day.fromordinal(last_day.toordinal() - window_days)
    window = [l for l in logs if l.day > cutoff]

    if not window:
        return TdeeEstimate(expenditure_kcal=0.0, confidence=0.0, window_days=0)

    trend = compute_trend(window)
    n_days = len(window)
    mean_intake = float(np.mean([l.intake_kcal for l in window]))

    # Δpeso de tendencia en la ventana (kg) y su equivalente calórico
    delta_weight = trend.slope_kg_per_day * n_days
    delta_kcal = weight_delta_to_kcal(delta_weight)

    # gasto = ingesta media − (cambio de reservas / días)
    expenditure = mean_intake - delta_kcal / n_days

    # Confianza simple: crece con días de datos y calidad de ajuste de la tendencia
    conf = min(1.0, n_days / 21.0)
    if trend.r_squared is not None:
        conf *= 0.5 + 0.5 * max(0.0, trend.r_squared)

    return TdeeEstimate(
        expenditure_kcal=float(expenditure),
        confidence=float(conf),
        window_days=n_days,
    )
