import { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-2xl shadow-card bg-white dark:bg-slate-800 " +
        "text-slate-900 dark:text-slate-100 p-4 " +
        className
      }
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const variants: Record<string, string> = {
    primary:
      "bg-slate-900 dark:bg-brand-500 text-white hover:opacity-90 active:scale-[0.98]",
    secondary:
      "bg-brand-600 text-white hover:opacity-90 active:scale-[0.98]",
    ghost:
      "bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700",
    danger:
      "bg-red-600 text-white hover:opacity-90 active:scale-[0.98]",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={
        "w-full rounded-xl py-3 font-semibold transition disabled:opacity-50 " +
        variants[variant] +
        " " +
        className
      }
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  ...rest
}: {
  label?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      {label && (
        <span className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
          {label}
        </span>
      )}
      <input
        {...rest}
        className={
          "w-full border border-slate-200 dark:border-slate-600 rounded-xl " +
          "px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 " +
          "outline-none focus:ring-2 focus:ring-brand-500 " +
          (rest.className ?? "")
        }
      />
    </label>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; icon?: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <nav className="sticky top-0 z-10 flex gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={
            "flex-1 rounded-xl py-2 text-sm font-medium transition " +
            (active === t.id
              ? "bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-300 shadow"
              : "text-slate-500 dark:text-slate-400")
          }
        >
          {t.icon ? `${t.icon} ` : ""}
          {t.label}
        </button>
      ))}
    </nav>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="text-center py-8 text-slate-400 dark:text-slate-500 animate-fade-in">
      <p className="text-3xl mb-2">📭</p>
      <p className="font-medium">{title}</p>
      {hint && <p className="text-sm mt-1">{hint}</p>}
    </div>
  );
}

export function Toggle({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      className="flex items-center gap-2 text-slate-500 dark:text-slate-400"
    >
      <span
        className={
          "relative inline-flex h-6 w-11 items-center rounded-full transition " +
          (on ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-600")
        }
      >
        <span
          className={
            "inline-block h-5 w-5 transform rounded-full bg-white transition " +
            (on ? "translate-x-5" : "translate-x-0.5")
          }
        />
      </span>
      {label && <span className="text-sm">{label}</span>}
    </button>
  );
}
