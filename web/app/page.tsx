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

  // estado de registro
  const [registro, setRegistro] = useState<Registro | null>(null);
  const [peso, setPeso] = useState("");
  const [calorias, setCalorias] = useState("");
  const [historial, setHistorial] = useState<Registro[]>([]);

  // estado de correlacion
  const [corr, setCorr] = useState<any>(null);
  const [corrLoading, setCorrLoading] = useState(false);

  // estado de auth (login/signup)
  const [modo, setModo] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
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
      const res = await fetch(`${backendUrl}/api/correlacion?dias=30`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const json = await res.json();
      setCorr(res.ok ? json : { error: json.detail || "Error" });
    } catch (e: any) {
      setCorr({ error: String(e) });
    } finally {
      setCorrLoading(false);
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMsg("");
    try {
      if (modo === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) setAuthMsg(error.message);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) setAuthMsg(error.message);
        else if (data.user && data.user.identities?.length === 0)
          setAuthMsg("Ese email ya está registrado. Usa Iniciar sesión.");
        else
          setAuthMsg(
            "Cuenta creada. Revisa tu email para confirmar (si está activada la confirmación).",
          );
      }
    } finally {
      setAuthLoading(false);
    }
  }

  if (loading) return <main className="p-6">Cargando…</main>;

  if (!user)
    return (
      <main className="max-w-md mx-auto p-4 space-y-5">
        <h1 className="text-2xl font-bold">MacroFactor Module</h1>
        <form
          onSubmit={handleAuth}
          className="bg-white rounded-2xl shadow p-4 space-y-3"
        >
          <h2 className="font-semibold">
            {modo === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </h2>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full border rounded-xl px-3 py-2"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (mín. 6)"
            className="w-full border rounded-xl px-3 py-2"
          />
          <button
            type="submit"
            disabled={authLoading}
            className="w-full bg-black text-white rounded-xl py-3 font-semibold disabled:opacity-50"
          >
            {authLoading
              ? "…"
              : modo === "login"
                ? "Entrar"
                : "Registrarme"}
          </button>
          {authMsg && <p className="text-sm text-red-600">{authMsg}</p>}
          <button
            type="button"
            onClick={() => {
              setModo(modo === "login" ? "signup" : "login");
              setAuthMsg("");
            }}
            className="w-full text-sm text-blue-600"
          >
            {modo === "login"
              ? "¿No tienes cuenta? Regístrate"
              : "¿Ya tienes cuenta? Inicia sesión"}
          </button>
        </form>
      </main>
    );

  const agua = registro?.agua_ml ?? 0;
  const aguaPct = Math.min(100, Math.round((agua / META_AGUA_ML) * 100));

  return (
    <main className="max-w-md mx-auto p-4 space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Hoy</h1>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            setUser(null);
          }}
          className="text-sm text-gray-500"
        >
          Salir
        </button>
      </div>

      <section className="bg-white rounded-2xl shadow p-4 space-y-3">
        <label className="block text-sm text-gray-600">
          Peso (ayunas, kg)
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
          placeholder="ej. 98.5"
          className="w-full border rounded-xl px-3 py-2"
        />
        <label className="block text-sm text-gray-600">
          Calorías consumidas
        </label>
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
          <div
            className="h-full bg-blue-500"
            style={{ width: `${aguaPct}%` }}
          />
        </div>
        {aguaPct >= 100 && (
          <p className="text-green-600 text-sm mb-2">
            ✓ Meta de agua alcanzada
          </p>
        )}
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

      <section className="bg-white rounded-2xl shadow p-4">
        <h2 className="font-semibold mb-2">Tendencia</h2>
        <TrendChart datos={historial} />
      </section>
    </main>
  );
}
