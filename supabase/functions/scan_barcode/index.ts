// Edge Function: escáner de código de barras (Open Food Facts).
//
// Invocar: { "barcode": "8410122072018" }
// Devuelve macros y guarda en caché local (tabla alimentos).
//
// Despliegue: supabase functions deploy scan_barcode

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { lookupBarcode } from "../_shared/barcode.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  try {
    const { barcode } = await req.json();
    if (!barcode) return json({ error: "barcode requerido" }, 400);

    // Cache local primero
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: cached } = await admin
      .from("alimentos")
      .select("*")
      .eq("barcode", barcode)
      .maybeSingle();
    if (cached) return json({ ok: true, cached: true, product: cached });

    const product = await lookupBarcode(barcode);
    if (!product) return json({ error: "no encontrado" }, 404);

    await admin.from("alimentos").upsert({
      barcode: product.barcode,
      name: product.name,
      kcal_100g: product.kcal100g,
      protein_100g: product.protein100g,
      carbs_100g: product.carbs100g,
      fat_100g: product.fat100g,
    });

    return json({ ok: true, cached: false, product });
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
