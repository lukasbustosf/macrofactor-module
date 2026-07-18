"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

interface Dato {
  fecha: string;
  peso_kg: number | null;
  agua_ml: number;
}

/** Regresión lineal simple (pendiente + intercepto). */
function linreg(pts: { x: number; y: number }[]) {
  const n = pts.length;
  const sx = pts.reduce((a, p) => a + p.x, 0);
  const sy = pts.reduce((a, p) => a + p.y, 0);
  const sxy = pts.reduce((a, p) => a + p.x * p.y, 0);
  const sxx = pts.reduce((a, p) => a + p.x * p.x, 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

export function TrendChart({
  datos,
  goalKg,
}: {
  datos: Dato[];
  goalKg?: number | null;
}) {
  if (!datos || datos.length === 0)
    return <p className="text-sm text-slate-500 dark:text-slate-400">Sin datos aún.</p>;

  const rows = datos.map((d, i) => ({ x: i, fecha: d.fecha.slice(5), peso: d.peso_kg }))
    .filter((r) => r.peso != null) as { x: number; fecha: string; peso: number }[];

  const trend =
    rows.length >= 2
      ? linreg(rows.map((r) => ({ x: r.x, y: r.peso })))
      : null;

  const data = datos.map((d, i) => ({
    fecha: d.fecha.slice(5),
    peso: d.peso_kg,
    trend: trend ? Math.round((trend.slope * i + trend.intercept) * 10) / 10 : null,
  }));

  const minPeso = Math.min(...data.map((d) => d.peso ?? Infinity));
  const maxPeso = Math.max(...data.map((d) => d.peso ?? -Infinity));
  const pad = Math.max(0.5, (maxPeso - minPeso) * 0.2 || 1);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <XAxis dataKey="fecha" tick={{ fontSize: 10 }} stroke="#94a3b8" />
        <YAxis
          domain={[Math.floor(minPeso - pad), Math.ceil(maxPeso + pad)]}
          tick={{ fontSize: 10 }}
          stroke="#94a3b8"
        />
        <Tooltip
          contentStyle={{
            background: "#0f172a",
            color: "#e2e8f0",
            borderRadius: 8,
            border: "none",
          }}
        />
        {goalKg != null && (
          <ReferenceLine
            y={goalKg}
            stroke="#a855f7"
            strokeDasharray="4 4"
            label={{ value: "meta", fill: "#a855f7", fontSize: 10, position: "insideTopRight" }}
          />
        )}
        <Line
          type="monotone"
          dataKey="peso"
          stroke="#38bdf8"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          name="Peso (kg)"
          connectNulls
        />
        {trend && (
          <Line
            type="monotone"
            dataKey="trend"
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            name="Tendencia"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
