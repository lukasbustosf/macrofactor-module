import { ReactNode } from "react";

/** Anillo de progreso SVG (0..100%). */
export function Ring({
  pct,
  label,
  value,
  sub,
  color = "#38bdf8",
}: {
  pct: number;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = c - (clamped / 100) * c;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-700"
            strokeWidth="10"
          />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold">{value}</span>
          {sub && <span className="text-[10px] text-slate-400">{sub}</span>}
        </div>
      </div>
      <span className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 dark:bg-slate-700/50 p-3 text-center">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-xl font-bold ${accent ?? ""}`}>{value}</p>
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function CoachBanner({ note }: { note?: string }) {
  if (!note) return null;
  return (
    <div className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white p-3 text-sm shadow">
      💡 <b>Coach:</b> {note}
    </div>
  );
}

export function ProgressBar({
  pct,
  color = "#38bdf8",
}: {
  pct: number;
  color?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function Grid2({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}
