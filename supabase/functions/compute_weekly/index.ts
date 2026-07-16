// Edge Function de Supabase: recalcula TDEE y meta semanal (algoritmo MVP).
//
// Invocar (ej. por un cron de Supabase) con body: { "userId": "uuid" }
// Lee registros_diarios de las últimas ~2 semanas, calcula con weeklyRecompute,
// actualiza perfiles.tdee_actual e inserta una fila en checkins.
//
// Despliegue:
//   supabase functions deploy compute_weekly
// Requiere secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { weeklyRecompute, DailyLog } from "../_shared/nutrition.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return json({ error: "userId requerido" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // --- Obtener registros de las últimas 2 semanas ---
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 14);
    const { data: rows, error: e1 } = await admin
      .from("registros_diarios")
      .select("fecha, peso_kg, calorias_consumidas, agua_ml")
      .eq("user_id", userId)
      .gte("fecha", since.toISOString().slice(0, 10))
      .order("fecha", { ascending: true });

    if (e1) return json({ error: e1.message }, 500);
    if (!rows || rows.length === 0) {
      return json({ error: "sin registros recientes" }, 404);
    }

    const logs: DailyLog[] = rows.map((r: any) => ({
      day: r.fecha,
      weightKg: r.peso_kg,
      intakeKcal: r.calorias_consumidas ?? 0,
      waterMl: r.agua_ml ?? 0,
    }));

    // --- deficit_objetivo del perfil ---
    const { data: perfil, error: e2 } = await admin
      .from("perfiles")
      .select("deficit_objetivo")
      .eq("id", userId)
      .single();
    if (e2) return json({ error: e2.message }, 500);

    const deficit = perfil?.deficit_objetivo ?? 0.15;
    const res = weeklyRecompute(logs, deficit);

    // --- Guardar: actualiza TDEE y escribe checkin de la semana ---
    const weekStart = new Date();
    const dow = weekStart.getUTCDay() || 7;
    weekStart.setUTCDate(weekStart.getUTCDate() - (dow - 1));
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    await admin.from("perfiles").update({ tdee_actual: Math.round(res.tdee) })
      .eq("id", userId);

    await admin.from("checkins").upsert({
      user_id: userId,
      week_start: weekStartStr,
      estimated_tdee: res.tdee,
      target_intake_kcal: res.metaDiaria,
      delta_peso_kg: res.deltaPesoKg,
      promedio_calorias: res.promedioCalorias,
      confidence: null,
    }, { onConflict: "user_id,week_start" });

    return json({ ok: true, ...res, week_start: weekStartStr });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
