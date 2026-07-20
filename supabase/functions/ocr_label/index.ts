// Edge Function: OCR de etiqueta nutricional (visión).
//
// Recibe una foto de la etiqueta y devuelve macros estructurados para
// prefillar el registro de comida. Pluggable: proveedor de visión configurado
// por env VISION_PROVIDER ("openai" | "anthropic"); usa la API key
// correspondiente (OPENAI_API_KEY | ANTHROPIC_API_KEY) como secret de Supabase.
//
// Validación: requiere JWT del usuario en Authorization (Bearer). No usa
// service_role en runtime — solo lee el usuario para autorizar.
//
// Invocar: POST /ocr_label  body: { "image_base64": "<data url o base64>",
//                                    "filename": "etiqueta.jpg" }
// Respuesta: { "ok": true, "nombre": "...", "porcion_g": 100,
//              "macros": { kcal, proteina, carbohidrato, grasa } }
//
// Despliegue: supabase functions deploy ocr_label
// Secrets requeridos: VISION_PROVIDER, OPENAI_API_KEY (o ANTHROPIC_API_KEY)
//                    SUPABASE_URL, SUPABASE_ANON_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const VISION_PROVIDER = (Deno.env.get("VISION_PROVIDER") ?? "openai").toLowerCase();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function authUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data } = await sb.auth.getUser(token);
  return data.user?.id ?? null;
}

function extractJson(text: string): any {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function visionOpenAI(
  apiKey: string,
  imageUrl: string,
): Promise<any> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Eres un lector de tablas nutricionales. Devuelve SOLO JSON con los campos: nombre (string), porcion_g (numero, tamaño de la porción declarada en la etiqueta), kcal, proteina, carbohidrato, grasa (todos por la porción declarada, en gramos salvo kcal). Si no aparece un valor usa 0.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Lee esta etiqueta nutricional:" },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      temperature: 0,
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error?.message ?? "OpenAI error");
  return extractJson(j.choices?.[0]?.message?.content ?? "");
}

async function visionAnthropic(
  apiKey: string,
  imageMediaType: string,
  imageB64: string,
): Promise<any> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1024,
      system:
        "Eres un lector de tablas nutricionales. Devuelve SOLO JSON con los campos: nombre (string), porcion_g (numero), kcal, proteina, carbohidrato, grasa (por la porción declarada). Si falta un valor usa 0.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Lee esta etiqueta nutricional." },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: imageMediaType,
                data: imageB64,
              },
            },
          ],
        },
      ],
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error?.message ?? "Anthropic error");
  return extractJson(j.content?.[0]?.text ?? "");
}

serve(async (req: Request) => {
  try {
    const userId = await authUser(req);
    if (!userId) return json({ error: "no autenticado" }, 401);

    const { image_base64 } = await req.json().catch(() => ({}));
    if (!image_base64) return json({ error: "image_base64 requerido" }, 400);

    let imageUrl = image_base64;
    let imageB64 = image_base64;
    let mediaType = "image/jpeg";
    if (image_base64.includes("base64,")) {
      const m = image_base64.match(/^data:(.*?);base64,(.*)$/);
      if (m) {
        mediaType = m[1];
        imageB64 = m[2];
        imageUrl = image_base64;
      }
    } else {
      imageUrl = `data:${mediaType};base64,${image_base64}`;
    }

    let parsed: any = null;
    if (VISION_PROVIDER === "anthropic") {
      const key = Deno.env.get("ANTHROPIC_API_KEY");
      if (!key) return json({ error: "ANTHROPIC_API_KEY no configurada" }, 500);
      parsed = await visionAnthropic(key, mediaType, imageB64);
    } else {
      const key = Deno.env.get("OPENAI_API_KEY");
      if (!key) return json({ error: "OPENAI_API_KEY no configurada" }, 500);
      parsed = await visionOpenAI(key, imageUrl);
    }

    if (!parsed) return json({ error: "no se pudo leer la etiqueta" }, 422);

    const num = (v: any) => {
      const n = parseFloat(v);
      return isNaN(n) ? 0 : n;
    };
    return json({
      ok: true,
      nombre: String(parsed.nombre ?? "Etiqueta OCR"),
      porcion_g: num(parsed.porcion_g) || 100,
      macros: {
        kcal: num(parsed.kcal),
        proteina: num(parsed.proteina),
        carbohidrato: num(parsed.carbohidrato),
        grasa: num(parsed.grasa),
      },
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
