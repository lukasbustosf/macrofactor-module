"""Recomputo semanal estilo MVP (plano de la investigación de Lukas).

Esta es la versión de 4 pasos del texto: promedios semanales en vez de EMA.
Coincide conceptualmente con `tdee_estimator`/`coach` pero usa la ventana
semanal explícita que propone el plano del MVP.

Algoritmo (Paso 1-4 de la investigación):
  P1. delta_peso = promedio_peso(esta_semana) - promedio_peso(semana_pasada)
  P2. deficit_real_semanal = -delta_peso * 7700        (positivo si bajó)
      deficit_real_diario  = deficit_real_semanal / 7
  P3. TDEE = promedio_calorias_semana + deficit_real_diario
  P4. meta  = TDEE * (1 - deficit_objetivo)

NOTA HONESTA: este método difiere del de `tdee_estimator` (EMA + regresión
sobre 21 días) y del de `coach` filosofía (A). Lo dejamos implementado porque
es el que pide explícitamente la investigación del MVP, y para que puedas
comparar ambos enfoques. El motor de producción debería elegir uno.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Sequence

import numpy as np

from .models import DailyLog, TdeeEstimate


def _week_key(d: date) -> date:
    """Lunes de la semana ISO a la que pertenece el día."""
    return d - timedelta_days(d.isoweekday() - 1)


def timedelta_days(n: int) -> "object":
    from datetime import timedelta
    return timedelta(days=n)


def weekly_recompute(
    logs: Sequence[DailyLog],
    deficit_objetivo: float = 0.15,
    kcal_per_kg: float = 7700.0,
) -> dict:
    """Calcula TDEE y nueva meta según el plano del MVP.

    Devuelve un dict con: tdee, meta_diaria, delta_peso_kg, deficit_real_diario,
    promedio_calorias, semana_actual, semana_pasada.
    """
    # Agrupar por semana (lunes de cada semana)
    by_week: dict[date, list[DailyLog]] = defaultdict(list)
    for l in logs:
        by_week[_week_key(l.day)].append(l)

    weeks = sorted(by_week.keys())
    if len(weeks) < 1:
        return {"tdee": 0.0, "meta_diaria": 0.0, "delta_peso_kg": 0.0}

    this_week = weeks[-1]
    weights_this = [l.weight_kg for l in by_week[this_week] if l.weight_kg is not None]
    kcal_this = [l.intake_kcal for l in by_week[this_week]]

    prom_peso_this = float(np.mean(weights_this)) if weights_this else 0.0
    prom_kcal = float(np.mean(kcal_this)) if kcal_this else 0.0

    delta_peso = 0.0
    prom_peso_prev = None
    if len(weeks) >= 2:
        prev_week = weeks[-2]
        weights_prev = [l.weight_kg for l in by_week[prev_week] if l.weight_kg is not None]
        prom_peso_prev = float(np.mean(weights_prev)) if weights_prev else None
        if prom_peso_prev is not None:
            delta_peso = prom_peso_this - prom_peso_prev

    deficit_real_semanal = -delta_peso * kcal_per_kg   # bajar => positivo
    deficit_real_diario = deficit_real_semanal / 7.0

    tdee = prom_kcal + deficit_real_diario
    meta = tdee * (1.0 - deficit_objetivo)

    return {
        "tdee": float(tdee),
        "meta_diaria": float(meta),
        "delta_peso_kg": float(delta_peso),
        "deficit_real_diario": float(deficit_real_diario),
        "promedio_calorias": prom_kcal,
        "semana_actual_peso": prom_peso_this,
        "semana_pasada_peso": prom_peso_prev,
    }
