"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TrendChart } from "./TrendChart";
import { coach } from "@/lib/coach";
import { useTheme } from "@/lib/theme";
import {
  Card,
  Button,
  Input,
  Tabs,
  Toggle,
  EmptyState,
} from "@/components/ui";
import {
  Ring,
  Stat,
  CoachBanner,
  Grid2,
} from "@/components/dash";
import { ComidaForm, ComidaList, ComidaRow } from "@/components/comida";
import { MenuFavoritos } from "@/components/menu";
import { TipoComida } from "@/lib/food";

const supabase = createClient();

interface MenuFav {
  id: string;
  nombre: string;
}

interface Registro {
  fecha: string;
  peso_kg: number | null;
  calorias_consumidas: number;
  agua_ml: number;
}

interface Perfil {
  id: string;
  altura_cm: number | null;
  deficit_objetivo: number;
  tdee_actual: number;
  objetivo: "cut" | "bulk" | "maintenance" | "custom";
}

const META_AGUA_ML = 3000;
type TabId = "hoy" | "semana" | "agua" | "perfil" | "comidas";
type Modo = "login" | "signup";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [registro, setRegistro] = useState<Registro | null>(null);
  const [peso, setPeso] = useState("");
  const [calorias, setCalorias] = useState("");
  const [historial, setHistorial] = useState<Registro[]>([]);
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const [comidas, setComidas] = useState<ComidaRow[]>([]);
  const [menus, setMenus] = useState<MenuFav[]>([]);

  const [corr, setCorr] = useState<any>(null);
  const [corrLoading, setCorrLoading] = useState(false);

  const [modo, setModo] = useState<Modo>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [onboarding, setOnboarding] = useState(false);
  const [obAltura, setObAltura] = useState("");
  const [obObjetivo, setObObjetivo] = useState<Perfil["objetivo"]>("cut");
  const [obDeficit, setObDeficit] = useState("15");

  const [tab, setTab] = useState<TabId>("hoy");
  const { theme, toggle } = useTheme();

  const hoy = new Date().toISOString().slice(0, 10);

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

  async function cargarPerfil() {
    if (!user) return;
    const { data } = await supabase
      .from("perfiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (data) {
      setPerfil(data as Perfil);
      if (data.altura_cm == null) setOnboarding(true);
    }
  }

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

  async function cargarComidas() {
    if (!user) return;
    const { data } = await supabase
      .from("comidas")
      .select("*")
      .eq("user_id", user.id)
      .eq("fecha", hoy);
    if (data) setComidas(data as ComidaRow[]);
    const { data: m } = await supabase
      .from("menu_favorito")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (m) setMenus(m as MenuFav[]);
  }

  async function guardarComida(c: Omit<ComidaRow, "id">) {
    if (!user) return;
    const { data, error } = await supabase
      .from("comidas")
      .insert({ ...c, user_id: user.id, fecha: hoy })
      .select()
      .single();
    if (!error && data) setComidas((prev) => [...prev, data as ComidaRow]);
  }

  async function borrarComida(id: string) {
    if (!user) return;
    await supabase.from("comidas").delete().eq("id", id);
    setComidas((prev) => prev.filter((c) => c.id !== id));
  }

  async function guardarMenu(nombre: string) {
    if (!user || comidas.length === 0) return;
    const { data, error } = await supabase
      .from("menu_favorito")
      .insert({ user_id: user.id, nombre })
      .select()
      .single();
    if (error || !data) return;
    const items = comidas.map((c) => ({
      menu_id: data.id,
      tipo_comida: c.tipo_comida,
      nombre: c.nombre,
      cantidad_g: c.cantidad_g,
      kcal: c.kcal,
      proteina: c.proteina,
      carbohidrato: c.carbohidrato,
      grasa: c.grasa,
    }));
    await supabase.from("menu_favorito_item").insert(items);
    setMenus((prev) => [...prev, data as MenuFav]);
  }

  async function clonarMenu(menuId: string) {
    if (!user) return;
    const { data: items } = await supabase
      .from("menu_favorito_item")
      .select("*")
      .eq("menu_id", menuId);
    if (!items) return;
    for (const it of items) {
      await guardarComida({
        tipo_comida: it.tipo_comida,
        nombre: it.nombre,
        cantidad_g: it.cantidad_g,
        kcal: it.kcal,
        proteina: it.proteina,
        carbohidrato: it.carbohidrato,
        grasa: it.grasa,
      });
    }
  }

  async function borrarMenu(menuId: string) {
    if (!user) return;
    await supabase.from("menu_favorito").delete().eq("id", menuId);
    setMenus((prev) => prev.filter((m) => m.id !== menuId));
  }

  useEffect(() => {
    if (user) {
      cargarPerfil();
      cargarRegistro();
      cargarComidas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function guardarPerfil() {
    if (!user) return;
    await supabase
      .from("perfiles")
      .update({
        altura_cm: obAltura ? parseInt(obAltura) : null,
        objetivo: obObjetivo,
        deficit_objetivo: parseInt(obDeficit) / 100,
      })
      .eq("id", user.id);
    setOnboarding(false);
    await cargarPerfil();
  }

  async function guardar() {
    if (!user) return;
    const payload = {
      user_id: user.id,
      fecha: hoy,
      peso_kg: peso ? parseFloat(peso) : null,
      calorias_consumidas: calorias ? parseInt(calorias) : 0,
      agua_ml: registro?.agua_ml ?? 0,
    };
    await supabase
      .from("registros_diarios")
      .upsert(payload, { onConflict: "user_id,fecha" });
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

  if (loading) return <main className="p-6 animate-fade-in">Cargando…</main>;

  if (!user)
    return (
      <main className="max-w-md mx-auto p-4 space-y-5 animate-fade-in">
        <h1 className="text-2xl font-bold">MacroFactor Module</h1>
        <Card>
          <h2 className="font-semibold mb-3">
            {modo === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </h2>
          <form
            onSubmit={handleAuth}
            className="space-y-3"
          >
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
            />
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (mín. 6)"
            />
            <Button type="submit" disabled={authLoading}>
              {authLoading
                ? "…"
                : modo === "login"
                  ? "Entrar"
                  : "Registrarme"}
            </Button>
          </form>
          {authMsg && <p className="text-sm text-red-600 mt-2">{authMsg}</p>}
          <button
            type="button"
            onClick={() => {
              setModo(modo === "login" ? "signup" : "login");
              setAuthMsg("");
            }}
            className="w-full text-sm text-brand-600 dark:text-brand-300 mt-2"
          >
            {modo === "login"
              ? "¿No tienes cuenta? Regístrate"
              : "¿Ya tienes cuenta? Inicia sesión"}
          </button>
        </Card>
      </main>
    );

  if (onboarding)
    return (
      <main className="max-w-md mx-auto p-4 space-y-5 animate-fade-in">
        <h1 className="text-2xl font-bold">Bienvenido</h1>
        <Card className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Necesitamos unos datos para estimar tu gasto.
          </p>
          <Input
            label="Altura (cm)"
            type="number"
            value={obAltura}
            onChange={(e) => setObAltura(e.target.value)}
            placeholder="ej. 175"
          />
          <label className="block">
            <span className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
              Objetivo
            </span>
            <select
              value={obObjetivo}
              onChange={(e) =>
                setObObjetivo(e.target.value as Perfil["objetivo"])
              }
              className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            >
              <option value="cut">Bajar grasa (cut)</option>
              <option value="bulk">Ganar músculo (bulk)</option>
              <option value="maintenance">Mantener</option>
            </select>
          </label>
          <Input
            label="Déficit objetivo (%)"
            type="number"
            value={obDeficit}
            onChange={(e) => setObDeficit(e.target.value)}
          />
          <Button onClick={guardarPerfil}>Guardar y empezar</Button>
        </Card>
      </main>
    );

  // --- Coach: meta diaria a partir de TDEE + déficit ---
  const tdee = perfil?.tdee_actual ?? 2500;
  const deficit = perfil?.deficit_objetivo ?? 0.15;
  const c = coach({
    tdee,
    deficitPct: deficit,
    objetivo: perfil?.objetivo ?? "cut",
    trendPesoKg:
      historial
        .filter((h) => h.peso_kg != null)
        .slice(-7)
        .reduce((a, h, _, arr) => a + (h.peso_kg ?? 0) / arr.length, 0) ||
      parseFloat(peso) ||
      0,
    confidence: historial.length >= 7 ? 0.6 : 0.2,
  });
  const metaDiaria = Math.round(c.targetIntake);
  const consumidoDesdeComidas = comidas.reduce((a, c) => a + (c.kcal || 0), 0);
  const consumido = consumidoDesdeComidas || registro?.calorias_consumidas || 0;
  const restante = metaDiaria - consumido;
  const agua = registro?.agua_ml ?? 0;
  const aguaPct = Math.min(100, Math.round((agua / META_AGUA_ML) * 100));

  const tabs = [
    { id: "hoy" as TabId, label: "Hoy", icon: "🏠" },
    { id: "comidas" as TabId, label: "Comidas", icon: "🍽️" },
    { id: "semana" as TabId, label: "Semana", icon: "📈" },
    { id: "agua" as TabId, label: "Agua", icon: "💧" },
    { id: "perfil" as TabId, label: "Perfil", icon: "👤" },
  ];

  return (
    <main className="max-w-md mx-auto p-4 space-y-4 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">MacroFactor</h1>
        <div className="flex items-center gap-3">
          <Toggle on={theme === "dark"} onToggle={toggle} label="🌙" />
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              setUser(null);
            }}
            className="text-sm text-slate-500 dark:text-slate-400"
          >
            Salir
          </button>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "hoy" && (
        <div className="space-y-4 animate-fade-in">
          {/* Anillo de calorías */}
          <Card className="flex items-center gap-4 border-0 bg-gradient-to-br from-brand-500 to-purple-600 text-white">
            <Ring
              pct={metaDiaria ? (consumido / metaDiaria) * 100 : 0}
              value={`${consumido}`}
              sub={`/ ${metaDiaria} kcal`}
              label="Consumido hoy"
              color="#fff"
            />
            <div className="flex-1 space-y-1">
              <p className="text-sm opacity-90">Tu objetivo de hoy</p>
              <p className="text-2xl font-bold">{restante >= 0 ? restante : 0} kcal</p>
              <p className="text-xs opacity-80">
                {restante >= 0 ? "restantes" : `excedido por ${Math.abs(restante)}`}
              </p>
              <p className="text-[11px] opacity-70 mt-1">
                TDEE ~{Math.round(tdee)} · déficit {Math.round(deficit * 100)}%
              </p>
            </div>
          </Card>

          <CoachBanner note={c.note} />

          {/* Stats rápidos */}
          <Grid2>
            <Stat
              label="Peso"
              value={peso ? `${peso} kg` : "—"}
              hint="ayunas"
            />
            <Stat
              label="Agua"
              value={`${Math.round(agua / 1000)}L`}
              hint={`/ ${META_AGUA_ML / 1000}L meta`}
              accent="text-blue-500"
            />
          </Grid2>

          {/* Registro */}
          <Card className="space-y-3">
            <h2 className="font-semibold">Registrar</h2>
            <Input
              label="Peso (ayunas, kg)"
              type="number"
              inputMode="decimal"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              placeholder="ej. 98.5"
            />
            <Input
              label="Calorías consumidas"
              type="number"
              inputMode="numeric"
              value={calorias}
              onChange={(e) => setCalorias(e.target.value)}
              placeholder="ej. 2000"
            />
            <Button onClick={guardar}>Guardar registro</Button>
          </Card>

          {/* Tendencia de peso */}
          <Card>
            <h2 className="font-semibold mb-1">Tendencia de peso</h2>
            <TrendChart datos={historial} goalKg={null} />
          </Card>
        </div>
      )}

      {tab === "semana" && (
        <div className="space-y-4 animate-fade-in">
          {historial.length === 0 ? (
            <Card>
              <EmptyState
                title="Sin datos todavía"
                hint="Registra tu peso y calorías en la pestaña Hoy para ver la tendencia."
              />
            </Card>
          ) : (
            <Card>
              <h2 className="font-semibold mb-2">Tendencia</h2>
              <TrendChart datos={historial} goalKg={null} />
            </Card>
          )}
          <Card>
            <h2 className="font-semibold mb-2">Agua → peso de mañana</h2>
            <Button
              onClick={verCorrelacion}
              disabled={corrLoading}
              variant="secondary"
            >
              {corrLoading ? "Calculando…" : "Ver correlación"}
            </Button>
            {corr?.error && (
              <p className="text-red-600 text-sm mt-2">{corr.error}</p>
            )}
            {corr && !corr.error && (
              <div className="mt-3 text-sm space-y-1">
                <p>
                  <b>r</b> = {corr.r?.toFixed(2)} · <b>n</b> = {corr.n} · <b>p</b> ={" "}
                  {corr.p_value?.toFixed(2)}
                </p>
                <p
                  className={
                    corr.interpretacion === "positivo"
                      ? "text-green-600"
                      : corr.interpretacion === "retencion"
                        ? "text-amber-600"
                        : "text-slate-600 dark:text-slate-300"
                  }
                >
                  {corr.detalle}
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "agua" && (
        <div className="space-y-4 animate-fade-in">
          <Card className="bg-blue-50 dark:bg-slate-800 border-0">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">Agua</span>
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {agua} / {META_AGUA_ML} ml
              </span>
            </div>
            <div className="h-3 bg-blue-200 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
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
            <Button
              onClick={() => addAgua(500)}
              className="bg-blue-500 text-white"
            >
              + 500 ml 💧
            </Button>
          </Card>
        </div>
      )}

      {tab === "perfil" && (
        <div className="space-y-4 animate-fade-in">
          <Card className="space-y-1">
            <h2 className="font-semibold mb-2">Tu perfil</h2>
            <p className="text-sm">
              Email: <b>{user.email}</b>
            </p>
            <p className="text-sm">
              Objetivo: <b>{perfil?.objetivo ?? "—"}</b>
            </p>
            <p className="text-sm">
              Altura: <b>{perfil?.altura_cm ?? "—"} cm</b>
            </p>
            <p className="text-sm">
              TDEE estimado: <b>{Math.round(tdee)} kcal</b>
            </p>
            <p className="text-sm">
              Déficit: <b>{Math.round(deficit * 100)}%</b>
            </p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              El TDEE se recalcula solo cada lunes con tus registros. Sigue
              cargando datos para mejorar la estimación.
            </p>
          </Card>
        </div>
      )}

      {tab === "comidas" && (
        <div className="space-y-4 animate-fade-in">
          <ComidaForm onAdd={guardarComida} />
          <Card>
            <h2 className="font-semibold mb-2">
              Ingesta por horario
              <span className="float-right text-brand-600 dark:text-brand-300">
                {consumido} kcal
              </span>
            </h2>
            <ComidaList rows={comidas} onDelete={borrarComida} />
          </Card>
          <MenuFavoritos
            rows={comidas}
            menus={menus}
            onGuardar={guardarMenu}
            onClonar={clonarMenu}
            onEliminar={borrarMenu}
          />
        </div>
      )}
    </main>
  );
}
