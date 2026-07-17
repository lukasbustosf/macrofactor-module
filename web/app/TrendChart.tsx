"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  ComposedChart,
  CartesianGrid,
} from "recharts";

interface Dato {
  fecha: string;
  peso_kg: number | null;
  agua_ml: number;
}

export function TrendChart({ datos }: { datos: Dato[] }) {
  if (!datos || datos.length === 0)
    return <p className="text-sm text-gray-500">Sin datos aún.</p>;

  const rows = datos.map((d) => ({
    fecha: d.fecha.slice(5), // MM-DD
    peso: d.peso_kg ?? null,
    agua: d.agua_ml,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
        <YAxis yAxisId="peso" tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
        <YAxis yAxisId="agua" orientation="right" hide />
        <Tooltip />
        <Bar yAxisId="agua" dataKey="agua" fill="#93c5fd" opacity={0.5} name="Agua (ml)" />
        <Line
          yAxisId="peso"
          type="monotone"
          dataKey="peso"
          stroke="#111"
          strokeWidth={2}
          dot={false}
          name="Peso (kg)"
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
