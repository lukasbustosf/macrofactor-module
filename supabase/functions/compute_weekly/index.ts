// Edge Function de Supabase: recalcula TDEE y meta semanal (algoritmo MVP).
//
// Invocar (ej. por pg_cron) con body:
//   { "userId": "uuid" }   -> un usuario
//   { "all": true }         -> todos los usuarios (modo cron semanal)
//
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function weekStartStr(d: Date): string {
  const dow = d.getUTCDay() || 7;
  const ws = new Date(d.getTime());
  ws.setUTCDate(d.getUTCDate() - (dow - 1));
  return ws.toISOString().slice(0, 10);
}

async function recomputeForUser(
  admin: any,
  userId: string,
): Promise<Record<string, unknown>> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 14);
  const { data: rows, error: e1 } = await admin
    .from("registros_diarios")
    .select("fecha, peso_kg, calorias_consumidas, agua_ml")
    .eq("user_id", userId)
    .gte("fecha", since.toISOString().slice(0, 10))
    .order("fecha", { ascending: true });
  if (e1) return { userId, error: e1.message };
  if (!rows || rows.length === 0) return { userId, skip: "sin registros" };

  const logs: DailyLog[] = rows.map((r: any) => ({
    day: r.fecha,
    weightKg: r.peso_kg,
    intakeKcal: r.calorias_consumidas ?? 0,
    waterMl: r.agua_ml ?? 0,
  }));

  const { data: perfil, error: e2 } = await admin
    .from("perfiles")
    .select("deficit_objetivo")
    .eq("id", userId)
    .single();
  if (e2) return { userId, error: e2.message };

  const deficit = perfil?.deficit_objetivo ?? 0.15;
  const res = weeklyRecompute(logs, deficit);
  const ws = weekStartStr(new Date());

  await admin
    .from("perfiles")
    .update({ tdee_actual: Math.round(res.tdee) })
    .eq("id", userId);

  await admin.from("checkins").upsert({
    user_id: userId,
    week_start: ws,
    estimated_tdee: res.tdee,
    target_intake_kcal: res.metaDiaria,
    delta_peso_kg: res.deltaPesoKg,
    promedio_calorias: res.promedioCalorias,
    confidence: null,
  }, { onConflict: "user_id,week_start" });

  return { userId, ok: true, ...res, week_start: ws };
}

serve(async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}));
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (body.all === true) {
      const { data: users, error: eu } = await admin
        .from("perfiles")
        .select("id");
      if (eu) return json({ error: eu.message }, 500);
      const results = [];
      for (const u of users ?? []) {
        results.push(await recomputeForUser(admin, u.id));
      }
      return json({ ok: true, processed: results.length, results });
    }

    const { userId } = body;
    if (!userId) return json({ error: "userId o all:true requerido" }, 400);
    const r = await recomputeForUser(admin, userId);
    if (r.error) return json(r, 500);
    return json(r);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
