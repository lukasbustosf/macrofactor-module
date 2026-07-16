"""Suavizado de la tendencia de peso.

El peso diario es ruidoso (retensión de líquidos, comida en el tracto, hora de
peso, etc.). MacroFactor no usa el peso crudo; deriva una *tendencia* suavizada
y es sobre esa línea sobre la que se calcula el gasto y la recomendación.

Enfoque base: Media Móvil Exponencialmente Ponderada (EMA) sobre los pesos
disponibles, más una regresión lineal sobre la ventana reciente para obtener
la pendiente (tasa de cambio real).

TODO(lukas): confirmar en tu investigación el método real de MF:
- ¿EMA con tau ~ X días? ¿ventana móvil? ¿regresión con pesos decrecientes?
- ¿cómo tratamiento de días sin pesada (skip vs interpolación)?
"""
from __future__ import annotations

from datetime import date
from typing import Sequence

import numpy as np

from .models import DailyLog, TrendResult


def _ema(values: list[float], alpha: float) -> list[float]:
    """Media móvil exponencial simple."""
    out: list[float] = []
    prev = values[0]
    for v in values:
        prev = alpha * v + (1 - alpha) * prev
        out.append(prev)
    return out


def compute_trend(
    logs: Sequence[DailyLog],
    alpha: float = 0.05,
    min_points: int = 7,
) -> TrendResult:
    """Calcula la tendencia de peso y su pendiente.

    Parámetros
    ----------
    logs: registros diarios (se ordenan por fecha; se ignoran los días sin peso).
    alpha: factor de suavizado de la EMA. MF usa algo equivalente a una ventana
           de varios días; alpha pequeño => tendencia más suave.
    min_points: mínimo de pesadas para dar una pendiente confiable.
    """
    pairs = sorted(
        ((l.day, l.weight_kg) for l in logs if l.weight_kg is not None),
        key=lambda x: x[0],
    )
    if not pairs:
        return TrendResult(trend_kg=0.0, slope_kg_per_day=0.0, slope_kg_per_week=0.0)

    days = [d for d, _ in pairs]
    weights = [w for _, w in pairs]

    # Tendencia suavizada (EMA) evaluada en el último punto
    smoothed = _ema(weights, alpha)
    trend = smoothed[-1]

    # Pendiente por regresión lineal (días relativos al primero)
    t0 = days[0]
    x = np.array([(d - t0).days for d in days], dtype=float)
    y = np.array(weights, dtype=float)

    if len(x) >= min_points and np.ptp(x) > 0:
        # numpy polyfit grado 1
        coeffs, residuals, *_ = np.polyfit(x, y, 1, full=True)
        slope_day = coeffs[0]
        ss_res = float(residuals[0]) if residuals.size else 0.0
        ss_tot = float(np.sum((y - y.mean()) ** 2))
        r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else None
    else:
        slope_day = 0.0
        r2 = None

    return TrendResult(
        trend_kg=trend,
        slope_kg_per_day=float(slope_day),
        slope_kg_per_week=float(slope_day * 7),
        r_squared=r2,
    )
