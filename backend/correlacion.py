"""Correlacion agua (hoy) <-> peso (manana).

Diferencial del usuario: sospecha que el agua que toma hoy baja (o sube,
por retencion) el peso que se pesa al dia siguiente. Estrenimiento +
retencion de liquidos de fondo.

El par es (agua_ml del dia D, peso_kg del dia D+1). Pearson + pendiente.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List, Tuple

Par = Tuple[float, float]  # (agua_ml_dia_d, peso_kg_dia_siguiente)


@dataclass
class ResultadoCorrelacion:
    n: int
    r: float
    p_value: float
    slope_kg_por_litro: float
    interpretacion: str
    detalle: str


def _pearsonr(x, y):
    """Pearson r + p-value (two-tailed) sin scipy (aprox normal para n>10)."""
    import numpy as np

    n = len(x)
    if n < 3:
        return 0.0, 1.0
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    mx, my = x.mean(), y.mean()
    cov = float(((x - mx) * (y - my)).sum())
    sx = float(np.sqrt(((x - mx) ** 2).sum()))
    sy = float(np.sqrt(((y - my) ** 2).sum()))
    if sx == 0 or sy == 0:
        return 0.0, 1.0
    r = cov / (sx * sy)
    if abs(r) >= 1.0:
        return (1.0 if r > 0 else -1.0), 0.0
    t = r * math.sqrt((n - 2) / (1 - r ** 2))
    p = 2 * (1 - 0.5 * (1 + math.erf(abs(t) / math.sqrt(2))))
    return float(r), float(p)


def calcular_correlacion(pares: List[Par]) -> ResultadoCorrelacion:
    """pares = [(agua_ml_dia_d, peso_kg_dia_d+1), ...]"""
    n = len(pares)
    if n < 3:
        return ResultadoCorrelacion(
            n=0,
            r=0.0,
            p_value=1.0,
            slope_kg_por_litro=0.0,
            interpretacion="insuficiente",
            detalle="Necesitas al menos 3 dias con agua hoy y peso pesado al dia siguiente.",
        )

    import numpy as np

    X = np.array([p[0] for p in pares], dtype=float)
    Y = np.array([p[1] for p in pares], dtype=float)
    r, p = _pearsonr(X, Y)
    slope_ml = float(np.polyfit(X, Y, 1)[0])  # kg por ml
    slope_l = slope_ml * 1000.0  # kg por litro extra

    if abs(r) < 0.3 or p > 0.05:
        inter = "inconcluso"
        det = (
            f"No hay correlacion clara (r={r:.2f}, p={p:.2f}). "
            "Sigue registrando agua y peso en ayunas."
        )
    elif r > 0:
        inter = "retencion"
        det = (
            f"Mas agua hoy tiende a SUBIR el peso de manana "
            f"(r={r:.2f}, +{slope_l:.3f} kg por litro extra). "
            "Probablemente retencion temporal de liquido, NO grasa."
        )
    else:
        inter = "positivo"
        det = (
            f"Mas agua hoy tiende a BAJAR el peso de manana "
            f"(r={r:.2f}, {slope_l:.3f} kg por litro extra). "
            "Hidratacion ayuda a bajar la retencion."
        )

    return ResultadoCorrelacion(
        n=n, r=r, p_value=p, slope_kg_por_litro=slope_l,
        interpretacion=inter, detalle=det,
    )
