"use client";

import { useState } from "react";
import { Card, Button, Input } from "@/components/ui";
import { ComidaRow } from "@/components/comida";

export function MenuFavoritos({
  rows,
  menus,
  onGuardar,
  onClonar,
  onEliminar,
}: {
  rows: ComidaRow[];
  menus: { id: string; nombre: string }[];
  onGuardar: (nombre: string) => void;
  onClonar: (menuId: string) => void;
  onEliminar: (menuId: string) => void;
}) {
  const [nombre, setNombre] = useState("");

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Menús favoritos</h2>
      {rows.length === 0 && (
        <p className="text-sm text-slate-400">
          Registra comidas hoy y guárdalas como plantilla.
        </p>
      )}
      <div className="flex gap-2">
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre (ej. Día cutting)"
        />
        <Button
          className="w-auto px-3"
          disabled={!nombre || rows.length === 0}
          onClick={() => {
            onGuardar(nombre);
            setNombre("");
          }}
        >
          Guardar
        </Button>
      </div>
      {menus.length > 0 && (
        <div className="space-y-1">
          {menus.map((m) => (
            <div
              key={m.id}
              className="flex justify-between items-center bg-slate-50 dark:bg-slate-700/40 rounded-xl px-3 py-2"
            >
              <span className="text-sm font-medium">{m.nombre}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => onClonar(m.id)}
                  className="text-brand-600 dark:text-brand-300 text-sm"
                >
                  Clonar
                </button>
                <button
                  onClick={() => onEliminar(m.id)}
                  className="text-red-500 text-sm"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
