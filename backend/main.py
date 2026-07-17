"""Backend de correlacion agua<->peso (Railway).

Lee registros_diarios DEL USUARIO LOGUEADO via su JWT (RLS de Supabase
activa, no se usa service_role). Devuelve la correlacion.

Endpoints:
  GET /api/correlacion?dias=30
      Header: Authorization: Bearer <jwt_del_usuario>
      -> { n, r, p_value, slope_kg_por_litro, interpretacion, detalle }
  GET /health
"""
import os
from datetime import date, timedelta
from typing import List, Tuple

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client

URL = os.environ.get("SUPABASE_URL")
ANON = os.environ.get("SUPABASE_ANON_KEY")

app = FastAPI(title="macrofactor-correlacion")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_headers=["*"],
    allow_methods=["*"],
)


def _next_day(iso: str) -> str:
    return (date.fromisoformat(iso) + timedelta(days=1)).isoformat()


def _build_pares(supabase, jwt: str, dias: int) -> List[Tuple[float, float]]:
    supabase.postgrest.auth(jwt)
    until = date.today()
    since = until - timedelta(days=dias + 2)
    res = (
        supabase.table("registros_diarios")
        .select("fecha, agua_ml, peso_kg")
        .gte("fecha", since.isoformat())
        .lte("fecha", until.isoformat())
        .order("fecha")
        .execute()
    )
    rows = res.data or []
    by_date = {r["fecha"]: r for r in rows}
    pares: List[Tuple[float, float]] = []
    for r in rows:
        agua = r.get("agua_ml")
        nxt = by_date.get(_next_day(r["fecha"]))
        if agua is not None and nxt and nxt.get("peso_kg") is not None:
            pares.append((float(agua), float(nxt["peso_kg"])))
    return pares


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/api/correlacion")
def correlacion(
    dias: int = Query(30, ge=7, le=180),
    authorization: str = Header(None),
):
    if not URL or not ANON:
        raise HTTPException(500, "Faltan SUPABASE_URL / SUPABASE_ANON_KEY")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Authorization: Bearer <jwt> requerido")
    jwt = authorization.split(" ", 1)[1].strip()
    supabase = create_client(URL, ANON)
    try:
        pares = _build_pares(supabase, jwt, dias)
    except Exception as e:  # noqa
        raise HTTPException(400, f"Error leyendo datos: {e}")
    from correlacion import calcular_correlacion

    return calcular_correlacion(pares).__dict__
