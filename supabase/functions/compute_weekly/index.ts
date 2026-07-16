// Edge Function de Supabase: recalcula TDEE y meta semanal (algoritmo MVP).
//
// Se invoca (ej. por un cron de Supabase) con el body:
//   { "userId": "uuid" }
// Lee registros_diarios de las últimas ~2 semanas y actualiza:
//   - perfiles.tdee_actual
//   - una fila en checkins (o registros_diarios de la semana)
//
// Deno + Supabase: `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";`

import { weeklyRecompute, DailyLog } from "../_shared/nutrition.ts";

// Nota: en Supabase Edge Functions se usa el cliente de Deno de Supabase.
// Aquí dejamos el esqueleto; el import real depende de tu setup (createClient).
declare const Deno: any;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req: Request) => {
  try {
    const { userId } = await req.json();

    // --- Obtener registros de las últimas 2 semanas ---
    // (pseudo: reemplazar con createClient(SUPABASE_URL, SERVICE_ROLE).from(...))
    const logs: DailyLog[] = await fetchLogs(userId);

    // --- Obtener deficit_objetivo del perfil ---
    const deficit = await fetchDeficit(userId); // default 0.15

    const res = weeklyRecompute(logs, deficit);

    // --- Guardar resultado ---
    await persist(userId, res);

    return new Response(JSON.stringify(res), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// ---- Stubs: conectar con el cliente de Supabase real ----
async function fetchLogs(_userId: string): Promise<DailyLog[]> {
  // SELECT fecha, peso_kg, calorias_consumidas, agua_ml
  // FROM registros_diarios WHERE user_id=$1 AND fecha >= now()-interval '14 days'
  return [];
}
async function fetchDeficit(_userId: string): Promise<number> {
  // SELECT deficit_objetivo FROM perfiles WHERE id=$1
  return 0.15;
}
async function persist(_userId: string, _res: unknown): Promise<void> {
  // UPDATE perfiles SET tdee_actual=$2 WHERE id=$1
  // INSERT INTO checkins (user_id, week_start, estimated_tdee, target_intake_kcal, ...)
  return;
}
