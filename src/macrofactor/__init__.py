"""Módulo de nutrición adaptativa — MacroFactor style.

API pública mínima:
    from macrofactor import recommend, weekly_recompute, estimate_tdee, compute_trend, models
"""
from . import models
from .coach import recommend
from .tdee_estimator import estimate_tdee
from .weight_trend import compute_trend
from .weekly_mvp import weekly_recompute

__all__ = ["models", "recommend", "weekly_recompute", "estimate_tdee", "compute_trend"]
__version__ = "0.1.0"
