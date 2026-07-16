"""Modelos de datos para el módulo de nutrición adaptativa.

Basado en la filosofía de MacroFactor:
- El TDEE se estima desde los datos reales del usuario (no fórmula poblacional).
- Se trabaja con tendencia de peso suavizada, no peso diario crudo.
- El objetivo calórico se reajusta según la tasa de cambio observada.

NOTA: los campos y defaults marcados con TODO deben validarse contra la
investigación aportada por Lukas antes de dar el módulo por "oficial".
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Optional


class ObjectiveType(str, Enum):
    """Tipo de objetivo nutricional."""
    CUT = "cut"                 # déficit, pérdida de peso
    BULK = "bulk"               # superávit, ganancia de peso
    MAINTENANCE = "maintenance" # mantenimiento
    CUSTOM = "custom"           # recomposición u objetivo personalizado


class Sex(str, Enum):
    MALE = "male"
    FEMALE = "female"


@dataclass
class DailyLog:
    """Registro diario de peso e ingesta."""
    day: date
    weight_kg: float                       # peso medido ese día (puede ser None si no se pesó)
    intake_kcal: float                     # calorías consumidas ese día
    # TODO(lukas): ¿MacroFactor separa activo/descanso? ¿usa expenditure reportado?
    expenditure_kcal: Optional[float] = None  # gasto del día si se conoce (raro en MF)


@dataclass
class Objective:
    """Configuración del objetivo del usuario.

    Dos filosofías de control (mutuamente excluyentes en la práctica):

    (A) Tasa por peso corporal (estilo MacroFactor clásico):
        rate_pct_per_week != 0  =>  el usuario fija velocidad de cambio.
        intake = expenditure + (peso * rate/100) * 7700 / 7

    (B) Porcentaje de déficit sobre mantenimiento (estilo MVP de la investigación):
        deficit_pct != 0  =>  meta = expenditure * (1 - deficit_pct)
        Ej. deficit_pct = 0.20  =>  comer 20% bajo el mantenimiento.
    """
    type: ObjectiveType
    # (A) Tasa de cambio de peso objetivo en % de peso corporal por semana.
    # Positivo = ganar (bulk), negativo = perder (cut), 0 = mantener.
    rate_pct_per_week: float = 0.0
    # (B) Porcentaje de déficit/superávit sobre el mantenimiento (0 = no usado).
    deficit_pct: float = 0.0
    start_date: Optional[date] = None


@dataclass
class TrendResult:
    """Resultado del suavizado de peso."""
    trend_kg: float                        # peso de tendencia actual
    slope_kg_per_day: float                # pendiente de la tendencia
    slope_kg_per_week: float               # pendiente por semana
    r_squared: Optional[float] = None      # calidad del ajuste (si aplica)


@dataclass
class TdeeEstimate:
    """Estimación del gasto energético total diario."""
    expenditure_kcal: float                # TDEE estimado
    confidence: float = 0.0                # 0-1, calidad de la estimación
    window_days: int = 0                   # días de datos usados


@dataclass
class Recommendation:
    """Recomendación de ingesta para el objetivo."""
    objective: ObjectiveType
    target_intake_kcal: float              # calorías objetivo recomendadas
    estimated_expenditure_kcal: float      # TDEE estimado subyacente
    expected_weekly_change_kg: float       # cambio de peso esperado/semana
    note: str = ""


def weight_delta_to_kcal(kg: float) -> float:
    """Convierte cambio de masa corporal a equivalente calórico.

    Aproximación estándar MacroFactor: ~7700 kcal por kg de tejido.
    TODO(lukas): MF usa un factor que depende de la composición (grasa vs magro)
    y del signo del balance; validar el valor exacto y si ajusta por sexo/objetivo.
    """
    return kg * 7700.0
