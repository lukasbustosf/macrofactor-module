"""Smoke tests del módulo. Verifican que la lógica base corre y da signos correctos.

NO son pruebas de exactitud contra MacroFactor real (esos valores deben validarse
con la investigación de Lukas). Solo revisan consistencia interna y dirección del efecto.
"""
from datetime import date, timedelta

import pytest

from macrofactor import coach, models, tdee_estimator, weight_trend


def _make_logs(n_days: int, start_weight: float, delta_per_day: float, intake: float):
    logs = []
    base = date(2026, 1, 1)
    for i in range(n_days):
        w = start_weight + delta_per_day * i
        logs.append(models.DailyLog(day=base + timedelta(days=i),
                                    weight_kg=w, intake_kcal=intake))
    return logs


def test_trend_slope_sign():
    logs = _make_logs(30, 80.0, -0.05, 2000)  # perdiendo peso
    t = weight_trend.compute_trend(logs)
    assert t.slope_kg_per_week < 0


def test_tdee_basic_range():
    logs = _make_logs(30, 80.0, 0.0, 2500)
    est = tdee_estimator.estimate_tdee(logs)
    # sin cambio de peso, gasto ~ ingesta
    assert 2000 < est.expenditure_kcal < 3000


def test_recommend_cut_is_deficit():
    logs = _make_logs(30, 80.0, 0.0, 2500)
    obj = models.Objective(type=models.ObjectiveType.CUT, rate_pct_per_week=-0.75)
    rec = coach.recommend(logs, obj)
    assert rec.target_intake_kcal < rec.estimated_expenditure_kcal


def test_recommend_bulk_is_surplus():
    logs = _make_logs(30, 80.0, 0.0, 2500)
    obj = models.Objective(type=models.ObjectiveType.BULK, rate_pct_per_week=0.5)
    rec = coach.recommend(logs, obj)
    assert rec.target_intake_kcal > rec.estimated_expenditure_kcal


def test_canonical_example_tdee_3050():
    """Ejemplo canónico de la investigación (texto de Lukas):

    Comer 2,500 kcal/día y perder 0.5 kg/semana => TDEE real = 3,050.
    Construimos 30 días con tendencia de peso bajando 0.5 kg/sem (≈ -0.0714 kg/d).
    """
    base = date(2026, 1, 1)
    logs = []
    for i in range(30):
        w = 90.0 - (0.5 / 7.0) * i  # baja 0.5 kg por semana
        logs.append(models.DailyLog(day=base + timedelta(days=i),
                                    weight_kg=w, intake_kcal=2500))
    est = tdee_estimator.estimate_tdee(logs)
    # TDEE debe estar cerca de 3050 (con margen por suavizado/regresión)
    assert 2900 < est.expenditure_kcal < 3200
    assert est.expenditure_kcal > 2500  # gasto real mayor que ingesta (hay déficit)


def test_mvp_weekly_example_2040():
    """Ejemplo canónico del plano MVP de Lukas:

    - Esta semana promedia 98.5 kg, la pasada 99.0 kg => delta -0.5 kg.
    - Calorías promedio 2,000/día.
    - TDEE = 2000 + 550 = 2,550.
    - déficit 20% => meta = 2,550 * 0.80 = 2,040.
    """
    from macrofactor import weekly_mvp

    logs = []
    # semana pasada (lunes..domingo): ~99.0 kg, 2000 kcal
    for i in range(7):
        d = date(2026, 1, 5) + timedelta(days=i)  # semana ISO que empieza lun 5/ene
        logs.append(models.DailyLog(day=d, weight_kg=99.0, intake_kcal=2000))
    # esta semana: ~98.5 kg, 2000 kcal
    for i in range(7):
        d = date(2026, 1, 12) + timedelta(days=i)
        logs.append(models.DailyLog(day=d, weight_kg=98.5, intake_kcal=2000))

    res = weekly_mvp.weekly_recompute(logs, deficit_objetivo=0.20)
    assert abs(res["delta_peso_kg"] - (-0.5)) < 1e-6
    assert abs(res["tdee"] - 2550.0) < 1e-6
    assert abs(res["meta_diaria"] - 2040.0) < 1e-6

