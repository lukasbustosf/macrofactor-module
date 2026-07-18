"use client";

import { useState } from "react";
import {
  Card,
  Button,
  Input,
} from "@/components/ui";
import {
  lookupBarcode,
  scaleMacros,
  Macro,
  TIPOS_COMIDA,
  TIPO_LABEL,
  TipoComida,
} from "@/lib/food";

export interface ComidaRow {
  id: string;
  tipo_comida: TipoComida;
  nombre: string;
  cantidad_g: number;
  kcal: number;
  proteina: number;
  carbohidrato: number;
  grasa: number;
}

export function ComidaForm({
  onAdd,
}: {
  onAdd: (c: Omit<ComidaRow, "id">) => void;
}) {
  const [tab, setTab] = useState<"barcode" | "manual" | "foto">("manual");
  const [tipo, setTipo] = useState<TipoComida>("desayuno");
  const [barcode, setBarcode] = useState("");
  const [nombre, setNombre] = useState("");
  const [gramos, setGramos] = useState("100");
  const [kcal, setKcal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function buscarBarcode() {
    setLoading(true);
    setMsg("");
    const r = await lookupBarcode(barcode);
    setLoading(false);
    if (!r) {
      setMsg("No encontrado en Open Food Facts.");
      return;
    }
    setNombre(r.nombre);
    const m = scaleMacros(r.macros, parseFloat(gramos) || 100);
    setKcal(String(m.kcal));
    setP(String(m.proteina));
    setC(String(m.carbohidrato));
    setF(String(m.grasa));
    setMsg(`✓ ${r.nombre}`);
  }

  function submit() {
    if (!nombre) {
      setMsg("Falta el nombre.");
      return;
    }
    onAdd({
      tipo_comida: tipo,
      nombre,
      cantidad_g: parseFloat(gramos) || 0,
      kcal: parseFloat(kcal) || 0,
      proteina: parseFloat(p) || 0,
      carbohidrato: parseFloat(c) || 0,
      grasa: parseFloat(f) || 0,
    });
    setMsg("");
    setNombre("");
    setKcal("");
    setP("");
    setC("");
    setF("");
  }

  return (
    <Card className="space-y-3">
      <div className="flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-700 p-1">
        {(["manual", "barcode", "foto"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "flex-1 rounded-lg py-1 text-xs font-medium " +
              (tab === t
                ? "bg-white dark:bg-slate-900 shadow"
                : "text-slate-500")
            }
          >
            {t === "manual" ? "✏️ Manual" : t === "barcode" ? "🔎 Código" : "📷 Foto"}
          </button>
        ))}
      </div>

      <select
        value={tipo}
        onChange={(e) => setTipo(e.target.value as TipoComida)}
        className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
      >
        {TIPOS_COMIDA.map((t) => (
          <option key={t} value={t}>
            {TIPO_LABEL[t]}
          </option>
        ))}
      </select>

      {tab === "barcode" && (
        <div className="flex gap-2">
          <Input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Código de barras"
          />
          <Button onClick={buscarBarcode} disabled={loading} className="w-auto px-3">
            {loading ? "…" : "Buscar"}
          </Button>
        </div>
      )}

      {tab === "foto" && (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-4 text-center text-sm text-slate-400">
          📷 OCR de etiqueta: próximamente (requiere proveedor de visión)
        </div>
      )}

      <Input
        label="Alimento"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="ej. Pechuga pollo"
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Gramos"
          type="number"
          value={gramos}
          onChange={(e) => setGramos(e.target.value)}
        />
        <Input
          label="kcal"
          type="number"
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
        />
        <Input label="Proteína g" type="number" value={p} onChange={(e) => setP(e.target.value)} />
        <Input label="Carbohidrato g" type="number" value={c} onChange={(e) => setC(e.target.value)} />
        <Input label="Grasa g" type="number" value={f} onChange={(e) => setF(e.target.value)} />
      </div>

      {msg && <p className="text-sm text-amber-600">{msg}</p>}
      <Button onClick={submit}>Agregar comida</Button>
    </Card>
  );
}

export function ComidaList({
  rows,
  onDelete,
}: {
  rows: ComidaRow[];
  onDelete: (id: string) => void;
}) {
  if (rows.length === 0)
    return (
      <p className="text-sm text-slate-400 text-center py-4">
        Aún no has registrado comidas hoy.
      </p>
    );
  const byTipo: Record<string, ComidaRow[]> = {};
  for (const r of rows) (byTipo[r.tipo_comida] ??= []).push(r);
  return (
    <div className="space-y-3">
      {TIPOS_COMIDA.filter((t) => byTipo[t]?.length).map((t) => (
        <div key={t}>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">
            {TIPO_LABEL[t]}
          </p>
          <div className="space-y-1">
            {byTipo[t].map((r) => (
              <div
                key={r.id}
                className="flex justify-between items-center bg-slate-50 dark:bg-slate-700/40 rounded-xl px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{r.nombre}</p>
                  <p className="text-xs text-slate-400">
                    {r.cantidad_g}g · {r.kcal} kcal · P{r.proteina} C{r.carbohidrato} F{r.grasa}
                  </p>
                </div>
                <button
                  onClick={() => onDelete(r.id)}
                  className="text-red-500 text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
