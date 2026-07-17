"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TrendChart } from "./TrendChart";

const supabase = createClient();

interface Registro {
  fecha: string;
  peso_kg: number | null;
  calorias_consumidas: number;
  agua_ml: number;
}

const META_AGUA_ML = 3000;

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registro, setRegistro] = useState<Registro | null>(null);
  const [peso, setPeso] = useState("");
  const [calorias, setCalorias] = useState("");
  const [historial, setHistorial] = useState<Registro[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
  }, []);

  const hoy = new Date().toISOString().slice(0, 10);

  async function cargarRegistro() {
    if (!user) return;
    const { data: hoyRow } = await supabase
      .from("registros_diarios")
      .select("*")
      .eq("user_id", user.id)
      .eq("fecha", hoy)
      .maybeSingle();
    if (hoyRow) {
      setRegistro(hoyRow);
      setPeso(String(hoyRow.peso_kg ?? ""));
      setCalorias(String(hoyRow.calorias_consumidas ?? ""));
    }
    const { data: hist } = await supabase
      .from("registros_diarios")
      .select("*")
      .eq("user_id", user.id)
      .order("fecha", { ascending: true });
    if (hist) setHistorial(hist as Registro[]);
  }

  useEffect(() => {
    if (user) cargarRegistro();
  }, [user]);

  async function guardar() {
    if (!user) return;
    const payload = {
      user_id: user.id,
      fecha: hoy,
      peso_kg: peso ? parseFloat(peso) : null,
      calorias_consumidas: calorias ? parseInt(calorias) : 0,
      agua_ml: registro?.agua_ml ?? 0,
    };
    await supabase.from("registros_diarios").upsert(payload, {
      onConflict: "user_id,fecha",
    });
    await cargarRegistro();
  }

  async function addAgua(ml: number) {
    if (!user) return;
    const nueva = (registro?.agua_ml ?? 0) + ml;
    await supabase.from("registros_diarios").upsert(
      {
        user_id: user.id,
        fecha: hoy,
        peso_kg: peso ? parseFloat(peso) : null,
        calorias_consumidas: calorias ? parseInt(calorias) : 0,
        agua_ml: nueva,
      },
      { onConflict: "user_id,fecha" },
    );
    await cargarRegistro();
  }

  if (loading) return <main className="p-6">Cargando…</main>;

  if (!user)
    return (
      <main className="p-6">
        <h1 className="text-xl font-bold mb-4">MacroFactor Module</h1>
        <button
          className="bg-black text-white rounded-xl px-4 py-3 w-full"
          onClick={async () => {
            const email = prompt("Email:");
            const pass = prompt("Password:");
            if (email && pass)
              await supabase.auth.signInWithPassword({ email, password: pass });
            const { data } = await supabase.auth.getUser();
            setUser(data.user);
          }}
        >
          Iniciar sesión
        </button>
      </main>
    );

  const agua = registro?.agua_ml ?? 0;
  const aguaPct = Math.min(100, Math.round((agua / META_AGUA_ML) * 100));

  const [corr, setCorr] = useState<any>(null);
  const [corrLoading, setCorrLoading] = useState(false);

  async function verCorrelacion() {
    setCorrLoading(true);
    setCorr(null);
    const { data: session } = await supabase.auth.getSession();
    const jwt = session.session?.access_token;
    if (!jwt) {
      setCorr({ error: "No hay sesión activa." });
      setCorrLoading(false);
      return;
    }
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    try {
      const res = await fetch(
        `${backendUrl}/api/correlacion?dias=30`,
        { headers: { Authorization: `Bearer ${jwt}` } },
      );
      const json = await res.json();
      setCorr(res.ok ? json : { error: json.detail || "Error" });
    } catch (e: any) {
      setCorr({ error: String(e) });
    } finally {
      setCorrLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-4 space-y-5">
      <h1 className="text-2xl font-bold">Hoy</h1>

      <section className="bg-white rounded-2xl shadow p-4 space-y-3">
        <label className="block text-sm text-gray-600">Peso (ayunas, kg)</label>
        <input
          type="number"
          inputMode="decimal"
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
          placeholder="ej. 98.5"
          className="w-full border rounded-xl px-3 py-2"
        />
        <label className="block text-sm text-gray-600">Calorías consumidas</label>
        <input
          type="number"
          inputMode="numeric"
          value={calorias}
          onChange={(e) => setCalorias(e.target.value)}
          placeholder="ej. 2000"
          className="w-full border rounded-xl px-3 py-2"
        />
        <button
          onClick={guardar}
          className="w-full bg-black text-white rounded-xl py-3 font-semibold"
        >
          Guardar registro
        </button>
      </section>

      <section className="bg-blue-50 rounded-2xl shadow p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-semibold">Agua</span>
          <span className="text-sm text-gray-600">
            {agua} / {META_AGUA_ML} ml
          </span>
        </div>
        <div className="h-3 bg-blue-200 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-blue-500" style={{ width: `${aguaPct}%` }} />
        </div>
        {aguaPct >= 100 && <p className="text-green-600 text-sm mb-2">✓ Meta de agua alcanzada</p>}
        <button
          onClick={() => addAgua(500)}
          className="w-full bg-blue-500 text-white rounded-xl py-4 text-lg font-bold active:scale-95 transition"
        >
          + 500 ml 💧
        </button>
      </section>

      <section className="bg-white rounded-2xl shadow p-4">
        <h2 className="font-semibold mb-2">Correlación agua → peso de mañana</h2>
        <button
          onClick={verCorrelacion}
          disabled={corrLoading}
          className="w-full bg-purple-600 text-white rounded-xl py-3 font-semibold disabled:opacity-50"
        >
          {corrLoading ? "Calculando…" : "Ver correlación"}
        </button>
        {corr?.error && (
          <p className="text-red-600 text-sm mt-2">{corr.error}</p>
        )}
        {corr && !corr.error && (
          <div className="mt-3 text-sm space-y-1">
            <p>
              <b>r</b> = {corr.r?.toFixed(2)} · <b>n</b> = {corr.n} ·{" "}
              <b>p</b> = {corr.p_value?.toFixed(2)}
            </p>
            <p
              className={
                corr.interpretacion === "positivo"
                  ? "text-green-600"
                  : corr.interpretacion === "retencion"
                    ? "text-amber-600"
                    : "text-gray-600"
              }
            >
              {corr.detalle}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
